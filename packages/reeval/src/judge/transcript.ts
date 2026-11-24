import { isObjectLike } from '../object.ts'
import { cutOutsideSecrets } from '../redact.ts'
import { clip, formatDuration } from '../text.ts'
import type { JudgeInputs, SubagentRun, TranscriptEvent } from '../types.ts'

/** Tool output and input beyond this many characters are clipped unless the judge sees `'full'`. */
export const TOOL_OUTPUT_CHARS = 300

type Mode = Exclude<JudgeInputs['transcript'], false | undefined>

const text = (value: unknown) =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value))

function toolInput(input: unknown): string {
  if (isObjectLike(input)) {
    for (const key of ['command', 'cmd', 'path', 'file_path', 'url', 'query', 'pattern']) {
      const value = input[key]
      if (typeof value === 'string') return value
    }
  }
  return text(input)
}

const indent = (block: string) =>
  block
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')

/** What the judge is told of one subagent: a turn's `SubagentRun` or the record's `SubagentRecord`. */
export type JudgeSubagent = Pick<
  SubagentRun,
  | 'id'
  | 'parent'
  | 'agent'
  | 'model'
  | 'prompt'
  | 'status'
  | 'durationMs'
  | 'events'
  | 'finalMessage'
> & { n?: number }

/** The judge's view of a transcript: the detail, and whose events show. */
type View = { detail: 'messages' | 'tools' | 'full'; agent: boolean; subagents: boolean }

const viewOf = (mode: Mode): View =>
  typeof mode === 'object'
    ? {
        detail: mode.detail ?? 'messages',
        agent: mode.agent !== false,
        subagents: mode.subagents !== false,
      }
    : { detail: mode === true ? 'messages' : mode, agent: true, subagents: true }

const subagentOf = (e: TranscriptEvent) => ('subagent' in e ? e.subagent : undefined)

/**
 * A turn's transcript as one entry per event, for the judge: compact lines, not raw events.
 * `true` shows messages and tool calls, `'tools'` tool calls only, `'full'` adds reasoning and
 * leaves tool input and output whole. Each subagent's events follow its spawn call, indented
 * under a line naming it from `runs`; a view without `agent` shows the subagents alone, each
 * with its task and last message.
 */
export function transcriptForJudge(
  events: readonly TranscriptEvent[],
  mode: Mode,
  runs: readonly JudgeSubagent[] = [],
): string[] {
  const view = viewOf(mode)
  const full = view.detail === 'full'
  const cut = (s: string) => {
    const c = full ? s : clip(s, TOOL_OUTPUT_CHARS)
    if (c === s) return s
    const kept = c.length - 1
    const at = cutOutsideSecrets(s, kept)
    return at < kept ? `${s.slice(0, at).trimEnd()}…` : c
  }
  const took = (ms: number | null) => (ms === null ? '' : ` · ${formatDuration(ms)}`)
  const result = (ok: boolean | null | undefined) =>
    ok === null ? 'unfinished' : ok === false ? 'failed' : 'ok'
  const line = (e: TranscriptEvent): string | undefined => {
    switch (e.type) {
      case 'text':
        return view.detail === 'tools' ? undefined : `message: ${e.text}`
      case 'reasoning':
        return full ? `reasoning: ${e.text}` : undefined
      case 'file-edit': {
        const removed = e.removed === null ? '' : ` −${e.removed}`
        const lines = e.added === null ? '' : `, +${e.added}${removed}`
        return `edit ${e.path} (${e.kind}${lines})${took(e.durationMs)}`
      }
      case 'web-search':
        return `search ${JSON.stringify(e.query)} → ${result(e.ok)}${took(e.durationMs)}`
      case 'web-fetch':
        return `fetch ${e.url} → ${result(e.ok)}${took(e.durationMs)}`
      case 'tool': {
        const head = `tool ${e.tool}: ${cut(toolInput(e.input))} → ${result(e.ok)}${took(e.durationMs)}`
        const output = e.output === undefined || e.output === null ? '' : cut(text(e.output)).trim()
        return output ? `${head}\n${indent(output)}` : head
      }
      case 'error':
        return `error: ${e.message}`
      case 'retry':
        return `retry: ${e.message}`
      default:
        return undefined
    }
  }

  const byId = new Map(runs.map((r) => [r.id, r]))
  const children = new Map<string, TranscriptEvent[]>()
  const own: TranscriptEvent[] = []
  for (const e of events) {
    const tag = subagentOf(e)
    if (tag === undefined) own.push(e)
    else children.set(tag, [...(children.get(tag) ?? []), e])
  }
  const shown = new Set<string>()
  const spawned = (e: TranscriptEvent) =>
    e.type === 'tool'
      ? [...new Set([...byId.keys(), ...children.keys()])].filter(
          (id) => id === e.toolCallId || id.startsWith(`${e.toolCallId}#`),
        )
      : []
  const block = (id: string, alone: boolean): string[] => {
    shown.add(id)
    const run = byId.get(id)
    const facts = [
      run?.agent,
      run?.model,
      run ? (run.status ?? 'unfinished') : undefined,
      run?.durationMs == null ? undefined : formatDuration(run.durationMs),
    ].filter(Boolean)
    const head = `subagent${run?.n ? ` ${run.n}` : ''}${facts.length ? ` (${facts.join(', ')})` : ''}:`
    const body: string[] = alone && run ? [`task: ${cut(run.prompt)}`] : []
    const mine = children.get(id) ?? []
    body.push(...walk(mine))
    if (run?.events === 'none' && !mine.length) {
      body.push("(its own actions aren't in the transcript; the diff has what it changed)")
    }
    if (alone && run?.finalMessage) body.push(`final message: ${cut(run.finalMessage)}`)
    return [head, ...body.map(indent)]
  }
  const walk = (list: readonly TranscriptEvent[]): string[] => {
    const out: string[] = []
    for (const e of list) {
      const l = line(e)
      if (l !== undefined) out.push(l)
      if (view.subagents) for (const id of spawned(e)) out.push(block(id, false).join('\n'))
    }
    return out
  }
  const out: string[] = []
  if (view.agent) out.push(...walk(own))
  if (view.subagents) {
    const roots = view.agent
      ? []
      : runs.filter((r) => r.parent === undefined || !byId.has(r.parent)).map((r) => r.id)
    for (const id of [...roots, ...children.keys()]) {
      if (!shown.has(id)) out.push(block(id, !view.agent).join('\n'))
    }
  }
  return out
}
