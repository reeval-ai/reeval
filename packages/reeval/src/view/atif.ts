// One trial as an ATIF trajectory (Harbor's Agent Trajectory Interchange Format): a user step
// per prompt, and agent steps folded from the trajectory. An agent step is one harness step where
// the trajectory numbers them, and starts again at a message that follows tool calls, since
// Codex's and Cursor's steps are whole turns. Each tool call is one `tool_calls` entry with its
// result in `observation`. A turn's tokens, cost and LLM calls go on its last agent step; a streamed
// subagent's events are an embedded trajectory its spawn call's result refers to. What ATIF has
// no field for (tool timing, `ok`, cost basis, the outcome) goes in `extra`. The eval's own
// `c.decide` calls aren't the agent's, so they're left out.
import type { TrialRecord, RunRecord } from '../history/types.ts'
import type { TokenUsage } from '../types.ts'
import type { Metrics, ObservationResult, Step, ToolCall, Trajectory } from './atif-schema.ts'
import type { TrajectoryLine } from './model.ts'

export const ATIF_VERSION = 'ATIF-v1.7'

type Turn = TrialRecord['turns'][number]

type Building = {
  step?: number
  turn: number
  ts: string
  texts: string[]
  reasoning: string[]
  calls: ToolCall[]
  results: ObservationResult[]
  errors: Array<{ type: string; message: string }>
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

function tokens(u: TokenUsage): Metrics {
  return {
    prompt_tokens: u.input + u.cacheRead + u.cacheWrite,
    completion_tokens: u.output,
    cached_tokens: u.cacheRead,
    extra: defined({
      cache_creation_input_tokens: u.cacheWrite,
      reasoning_tokens: u.reasoning ?? undefined,
    }),
  }
}

/** The ATIF trajectory of `trial`, from its record and its `trajectory.jsonl` lines. */
export function toAtif(
  run: RunRecord,
  trial: TrialRecord,
  lines: TrajectoryLine[],
): Trajectory {
  const cell = run.evals
    .find((e) => e.trials.some((a) => a.key === trial.key))
    ?.cells.find((c) => c.key === trial.cell)
  const version = run.stack.images.find((i) => i.id === trial.imageId)?.agentCli ?? 'unknown'
  const name = cell?.harnessKind ?? 'unknown'
  const records = new Map((trial.subagents ?? []).map((s) => [s.id, s]))
  const parentOf = (id: string) => records.get(id)?.parent
  // A subagent that streamed nothing itself still holds the trajectories of those it spawned.
  const tagged = new Set<string>()
  for (const line of lines) {
    let id = 'subagent' in line ? line.subagent : undefined
    while (id && !tagged.has(id)) {
      tagged.add(id)
      id = parentOf(id)
    }
  }

  // Each turn's share of `activity.llmCalls`, from the same source: its `main` model calls where
  // the gateway saw any, else its highest step.
  const callsByTurn = () => {
    const counts = new Map<number, number>()
    if (trial.activity.llmCalls === null) return counts
    const calls = lines.filter((l) => l.type === 'model-call')
    for (const l of calls.length ? calls : lines) {
      const n = counts.get(l.turn) ?? 0
      if (l.type === 'model-call') counts.set(l.turn, n + (l.role === 'side' ? 0 : 1))
      else if ('step' in l && l.step) counts.set(l.turn, Math.max(n, l.step))
    }
    return counts
  }

  const build = (scope: string | undefined): { steps: Step[]; subs: Trajectory[] } => {
    const subs = [...tagged].filter((id) => parentOf(id) === scope).map((id) => subagent(id))
    const spawned = new Set(subs.map((s) => s.trajectory_id))
    const steps: Step[] = []
    const lastOfTurn = new Map<number, number>()
    let cur = null as Building | null
    const close = () => {
      if (!cur) return
      const turn: Turn | undefined = scope === undefined ? trial.turns[cur.turn] : undefined
      steps.push(
        defined({
          step_id: steps.length + 1,
          timestamp: cur.ts,
          source: 'agent' as const,
          model_name:
            scope === undefined
              ? (turn?.servedModel ?? turn?.model ?? undefined)
              : records.get(scope)?.model,
          reasoning_effort:
            scope === undefined ? (turn?.servedEffort ?? trial.effort ?? undefined) : undefined,
          message: cur.texts.join('\n\n'),
          reasoning_content: cur.reasoning.length ? cur.reasoning.join('\n\n') : undefined,
          tool_calls: cur.calls.length ? cur.calls : undefined,
          observation: cur.results.length ? { results: cur.results } : undefined,
          extra: cur.errors.length ? { errors: cur.errors } : undefined,
        }),
      )
      lastOfTurn.set(cur.turn, steps.length - 1)
      cur = null
    }
    const open = (line: TrajectoryLine) => {
      close()
      cur = {
        step: 'step' in line ? line.step : undefined,
        turn: line.turn,
        ts: line.ts,
        texts: [],
        reasoning: [],
        calls: [],
        results: [],
        errors: [],
      }
      return cur
    }
    const stepChanged = (line: TrajectoryLine) =>
      'step' in line && line.step !== undefined && cur?.step !== undefined && line.step !== cur.step

    if (scope !== undefined) {
      const record = records.get(scope)
      steps.push({ step_id: 1, source: 'user', message: record?.prompt ?? '' })
    }
    for (const line of lines) {
      if ((('subagent' in line && line.subagent) || undefined) !== scope) continue
      switch (line.type) {
        case 'prompt':
          close()
          steps.push({
            step_id: steps.length + 1,
            timestamp: line.ts,
            source: 'user',
            message: line.text,
          })
          break
        case 'turn-end':
          close()
          break
        case 'model-call':
        case 'decision':
          break
        case 'text':
        case 'reasoning': {
          const b = !cur || cur.calls.length || stepChanged(line) ? open(line) : cur
          ;(line.type === 'text' ? b.texts : b.reasoning).push(line.text)
          break
        }
        case 'error':
        case 'retry': {
          const b = cur ?? open(line)
          b.errors.push({ type: line.type, message: line.message })
          break
        }
        default: {
          const b = !cur || stepChanged(line) ? open(line) : cur
          const { input, output } = line
          const fallback =
            line.type === 'file-edit'
              ? { path: line.path }
              : line.type === 'web-search'
                ? { query: line.query }
                : line.type === 'web-fetch'
                  ? { url: line.url }
                  : {}
          b.calls.push(
            defined({
              tool_call_id: line.toolCallId,
              function_name: line.type === 'tool' ? line.tool : line.type,
              arguments: isObject(input) ? input : input === undefined ? fallback : { input },
              extra:
                line.type === 'file-edit'
                  ? { path: line.path, kind: line.kind, added: line.added, removed: line.removed }
                  : line.type === 'web-search'
                    ? defined({ query: line.query, references: line.references })
                    : line.type === 'web-fetch'
                      ? defined({ url: line.url, status: line.status, bytes: line.bytes })
                      : undefined,
            }),
          )
          b.results.push(
            defined({
              source_call_id: line.toolCallId,
              content:
                output === undefined || output === null
                  ? undefined
                  : typeof output === 'string'
                    ? output
                    : JSON.stringify(output),
              subagent_trajectory_ref: spawned.has(line.toolCallId)
                ? [{ trajectory_id: line.toolCallId }]
                : undefined,
              extra: defined({
                ok: 'ok' in line ? line.ok : undefined,
                durationMs: line.durationMs,
                outputView: line.outputView,
                outputTruncated: line.outputTruncated,
                stalled: line.stalled,
                durationInferred: line.durationInferred,
              }),
            }),
          )
        }
      }
    }
    close()
    if (scope === undefined) {
      const calls = callsByTurn()
      for (const [turn, at] of lastOfTurn) {
        const t = trial.turns[turn]
        const step = steps[at] as Step
        if (t?.usage) step.metrics = defined({ ...tokens(t.usage), cost_usd: t.cost?.usd })
        if (calls.get(turn)) step.llm_call_count = calls.get(turn)
      }
    }
    return { steps, subs }
  }

  function subagent(id: string): Trajectory {
    const record = records.get(id)
    const { steps, subs } = build(id)
    return defined({
      schema_version: ATIF_VERSION,
      trajectory_id: id,
      agent: defined({ name, version, model_name: record?.model ?? cell?.model ?? undefined }),
      steps,
      final_metrics: record?.usage
        ? defined({ ...totals(record.usage), total_steps: steps.length })
        : { total_steps: steps.length },
      extra: record ? defined({ agent: record.agent, status: record.status }) : undefined,
      subagent_trajectories: subs.length ? subs : undefined,
    })
  }

  const { steps, subs } = build(undefined)
  const sum = trial.usage ? totals(trial.usage) : undefined
  const cost = trial.cost && { cost_basis: trial.cost.basis, cost_source: trial.cost.source }
  return defined({
    schema_version: ATIF_VERSION,
    session_id: run.runId,
    trajectory_id: trial.key,
    agent: defined({ name, version, model_name: cell?.model ?? undefined }),
    steps,
    final_metrics: defined({
      ...sum,
      total_cost_usd: trial.cost?.usd,
      total_steps: steps.length,
      extra: sum || cost ? { ...sum?.extra, ...cost } : undefined,
    }),
    extra: { outcome: trial.outcome },
    subagent_trajectories: subs.length ? subs : undefined,
  })
}

function totals(u: TokenUsage) {
  const m = tokens(u)
  return {
    total_prompt_tokens: m.prompt_tokens,
    total_completion_tokens: m.completion_tokens,
    total_cached_tokens: m.cached_tokens,
    extra: m.extra,
  }
}
