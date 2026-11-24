// What each harness's spawn calls say about the subagents they started, and where Claude Code
// stores a subagent's own usage.
import { shellQuote } from '@ai-sdk/harness/utils'
import type { TranscriptEvent } from '../types.ts'
import type { SpawnedSubagent, StoredSubagent, StoredSubagents } from './entry.ts'

type ToolEvent = Extract<TranscriptEvent, { type: 'tool' }>

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
const num = (value: unknown) => (typeof value === 'number' ? value : undefined)

const toolCalls = (events: readonly TranscriptEvent[], names: readonly string[]) =>
  events.filter((e): e is ToolEvent => e.type === 'tool' && names.includes(e.tool))

/** A harness's word for how a subagent ended, as `SubagentRun['status']`. */
function statusOf(said: string | undefined): SpawnedSubagent['status'] {
  if (said === 'completed') return 'completed'
  if (said === 'failed' || said === 'errored' || said === 'error') return 'failed'
  if (said === 'canceled' || said === 'killed' || said === 'stopped' || said === 'shutdown')
    return 'canceled'
  return null
}

const okStatus = (ok: boolean | null): SpawnedSubagent['status'] =>
  ok === null ? null : ok ? 'completed' : 'failed'

/** Claude's tool result content: a string, or a list of `{ type: 'text', text }`. */
const textOf = (content: unknown): string | undefined =>
  Array.isArray(content)
    ? content.map((c) => str(record(c).text) ?? '').join('') || undefined
    : str(content)

/**
 * Claude Code's `Agent` (or `Task`) calls. The result names the subagent's agent id and model;
 * a background one's result comes as it starts, so its status and summary come from the stream's
 * `task_notification`, when it finished within the turn.
 */
export function claudeSpawns(
  events: readonly TranscriptEvent[],
  raw: readonly unknown[],
): SpawnedSubagent[] {
  const notified = new Map<string, Record<string, unknown>>()
  for (const part of raw) {
    const value = record(record(part).rawValue)
    const id = str(value.tool_use_id)
    if (value.type === 'system' && value.subtype === 'task_notification' && id) {
      notified.set(id, value)
    }
  }
  return toolCalls(events, ['Agent', 'Task']).map((e) => {
    const input = record(e.input)
    const output = record(e.output)
    const note = notified.get(e.toolCallId)
    const background = input.run_in_background === true || output.isAsync === true
    const status = note
      ? statusOf(str(note.status))
      : background
        ? null
        : e.ok === false
          ? 'failed'
          : (statusOf(str(output.status)) ?? okStatus(e.ok))
    const durationMs = num(output.totalDurationMs) ?? num(record(note?.usage).duration_ms) ?? null
    const finalMessage = (background ? str(note?.summary) : textOf(output.content)) ?? undefined
    const nativeId = str(output.agentId)
    const agent = str(output.agentType) ?? str(input.subagent_type)
    const model = str(output.resolvedModel)
    return {
      id: e.toolCallId,
      ...(nativeId ? { nativeId } : {}),
      ...(agent ? { agent } : {}),
      ...(model ? { model } : {}),
      prompt: str(input.prompt) ?? '',
      status,
      durationMs,
      ...(background ? { background: true as const } : {}),
      ...(finalMessage ? { finalMessage } : {}),
    }
  })
}

/**
 * Codex's `spawn_agent` calls. Its result's `agents_states` is keyed by the new thread's id; the
 * last `wait`, `send_input` or `close_agent` call on that thread says how it ended, and its message.
 */
export function codexSpawns(events: readonly TranscriptEvent[]): SpawnedSubagent[] {
  const latest = new Map<string, Record<string, unknown>>()
  for (const e of toolCalls(events, ['spawn_agent', 'wait', 'send_input', 'close_agent'])) {
    for (const [thread, state] of Object.entries(record(e.output)))
      latest.set(thread, record(state))
  }
  return toolCalls(events, ['spawn_agent']).map((e) => {
    const nativeId = Object.keys(record(e.output))[0]
    const state = nativeId ? latest.get(nativeId) : undefined
    const finalMessage = str(state?.message)
    return {
      id: e.toolCallId,
      ...(nativeId ? { nativeId } : {}),
      prompt: str(record(e.input).prompt) ?? '',
      status: e.ok === false ? 'failed' : statusOf(str(state?.status)),
      durationMs: null,
      ...(finalMessage ? { finalMessage } : {}),
    }
  })
}

/** Cursor's `task` calls, whose result names the subagent's agent id and its time. */
export function cursorSpawns(events: readonly TranscriptEvent[]): SpawnedSubagent[] {
  return toolCalls(events, ['task']).map((e) => {
    const input = record(e.input)
    const output = record(e.output)
    const nativeId = str(output.agentId)
    const agent = str(input.subagentType) ?? str(record(input.subagentType).name)
    return {
      id: e.toolCallId,
      ...(nativeId ? { nativeId } : {}),
      ...(agent ? { agent } : {}),
      prompt: str(input.prompt) ?? '',
      status: okStatus(e.ok),
      durationMs: num(output.durationMs) ?? e.durationMs,
      ...(output.isBackground === true ? { background: true as const } : {}),
    }
  })
}

/**
 * Antigravity's `invoke_subagent` calls, each starting every subagent its `subagents` lists. The
 * call returns as they start, with nothing about how they end.
 */
export function antigravitySpawns(events: readonly TranscriptEvent[]): SpawnedSubagent[] {
  return toolCalls(events, ['invoke_subagent']).flatMap((e) => {
    const listed = Array.isArray(record(e.input).subagents)
      ? (record(e.input).subagents as unknown[])
      : []
    return listed.map((s, i) => {
      const agent = str(record(s).agent)
      return {
        id: listed.length > 1 ? `${e.toolCallId}#${i + 1}` : e.toolCallId,
        ...(agent ? { agent } : {}),
        prompt: str(record(s).prompt) ?? '',
        status: e.ok === false ? 'failed' : null,
        durationMs: null,
        background: true as const,
      }
    })
  })
}

/** OpenCode's `subagent` calls, whose result's metadata names the child session and its state. */
export function opencodeSpawns(events: readonly TranscriptEvent[]): SpawnedSubagent[] {
  return toolCalls(events, ['subagent', 'task']).map((e) => {
    const input = record(e.input)
    const output = record(e.output)
    const meta = record(output.metadata)
    const nativeId = str(meta.sessionID)
    const agent = str(input.agent) ?? str(input.subagent_type)
    const finalMessage = str(output.output) ?? str(e.output)
    return {
      id: e.toolCallId,
      ...(nativeId ? { nativeId } : {}),
      ...(agent ? { agent } : {}),
      prompt: str(input.prompt) ?? '',
      status: e.ok === false ? 'failed' : (statusOf(str(meta.status)) ?? okStatus(e.ok)),
      durationMs: e.durationMs,
      ...(finalMessage ? { finalMessage } : {}),
    }
  })
}

/** An ACP tool result's text: a list of `{ type: 'content', content: { text } }`. */
const acpText = (output: unknown): string | undefined =>
  Array.isArray(output)
    ? output.map((c) => str(record(record(c).content).text) ?? '').join('') || undefined
    : undefined

/**
 * The calls to `tools`, for a harness whose spawn call's result says no more than how it went;
 * a `background` one returns as its subagent starts, so says nothing of how it ends.
 */
export const toolSpawns =
  (tools: readonly string[], background = false) =>
  (events: readonly TranscriptEvent[]): SpawnedSubagent[] =>
    toolCalls(events, tools).map((e) => {
      const input = record(e.input)
      const finalMessage = str(e.output) ?? acpText(e.output)
      return {
        id: e.toolCallId,
        prompt:
          str(input.prompt) ??
          str(input.task) ??
          str(input.instructions) ??
          str(input.description) ??
          '',
        status: background ? (e.ok === false ? 'failed' : null) : okStatus(e.ok),
        durationMs: background ? null : e.durationMs,
        ...(background ? { background: true as const } : {}),
        ...(finalMessage ? { finalMessage } : {}),
      }
    })

/**
 * Prints, as one JSON object by agent id, each Claude Code subagent's usage from its own
 * transcript (`<config>/projects/<cwd>/<session>/subagents/agent-<id>.jsonl`). The stream's copy
 * of a subagent's message carries its output tokens as they stood when it started; the stored one
 * has the final count. A message stored once per content block is counted once, by its id.
 */
const CLAUDE_SCRIPT = `const fs = require('fs'), path = require('path'), os = require('os')
const ids = new Set(process.argv.slice(1))
const root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects')
const out = {}
const walk = (d) => {
  let entries = []
  try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch {}
  for (const e of entries) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { walk(p); continue }
    const m = /^agent-(.+)\\.jsonl$/.exec(e.name)
    if (!m || !ids.has(m[1])) continue
    const messages = new Map(), times = []
    let model
    for (const line of fs.readFileSync(p, 'utf8').split('\\n')) {
      let r
      try { r = JSON.parse(line) } catch { continue }
      const t = Date.parse(r && r.timestamp)
      if (t) times.push(t)
      const msg = r && r.type === 'assistant' && r.message
      if (!msg || !msg.usage) continue
      messages.set(msg.id || messages.size, msg.usage)
      if (msg.model) model = msg.model
    }
    const u = { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0, thinking_tokens: 0 }
    for (const v of messages.values()) {
      for (const k of Object.keys(u)) u[k] += (k === 'thinking_tokens' ? (v.output_tokens_details || {}).thinking_tokens : v[k]) || 0
    }
    out[m[1]] = { usage: u, calls: messages.size, model, startedAt: times[0], endedAt: times[times.length - 1] }
  }
}
walk(root)
process.stdout.write(JSON.stringify(out))
`

/** The command that prints the stored usage of Claude Code's subagents with these agent ids. */
export function claudeStoredSubagentsCommand(ids: readonly string[]): string {
  return ['node', '-e', CLAUDE_SCRIPT, ...ids].map(shellQuote).join(' ')
}

/** What {@link claudeStoredSubagentsCommand} printed, in the AI SDK's usage shape. */
export function parseClaudeStoredSubagents(stdout: string): Record<string, StoredSubagent> {
  let value: unknown
  try {
    value = JSON.parse(stdout)
  } catch {
    return {}
  }
  const out: Record<string, StoredSubagent> = {}
  for (const [id, said] of Object.entries(record(value))) {
    const s = record(said)
    if (!num(s.calls)) continue
    const u = record(s.usage)
    const n = (k: string) => num(u[k]) ?? 0
    const [input, cacheRead, cacheWrite] = [
      n('input_tokens'),
      n('cache_read_input_tokens'),
      n('cache_creation_input_tokens'),
    ]
    const model = str(s.model)
    const startedAt = num(s.startedAt)
    const endedAt = num(s.endedAt)
    out[id] = {
      usage: {
        inputTokens: {
          total: input + cacheRead + cacheWrite,
          noCache: input,
          cacheRead,
          cacheWrite,
        },
        outputTokens: {
          total: n('output_tokens'),
          text: undefined,
          reasoning: n('thinking_tokens'),
        },
      },
      ...(model ? { model } : {}),
      ...(startedAt ? { startedAt } : {}),
      ...(endedAt ? { endedAt } : {}),
    }
  }
  return out
}

export const claudeStoredSubagents: StoredSubagents = {
  command: claudeStoredSubagentsCommand,
  parse: parseClaudeStoredSubagents,
}
