// One attempt as the agent export's trace, from its finished record: what the agent did, in the
// OpenTelemetry GenAI conventions with OpenInference's attributes beside them, for LLM tracing
// tools. One trace per attempt, with the run as its session:
//
//   invoke_agent <harness>    the attempt (AGENT), with a gen_ai.evaluation.result event per check
//                             and per judgment, and a link to the attempt's span in the run's trace
//     turn <n>                each turn (CHAIN), with its errors and retries as events
//       chat <model>          each model call the egress gateway saw (LLM)
//       execute_tool <tool>   each tool call (TOOL); a subagent's calls under the call that spawned it,
//                             which carries the subagent's own tokens
//
// No content: prompts, agent text, reasoning and tool input and output stay out. Ids come from the
// run, the attempt, its start and what each span is, so a turn's spans sent as it ends and the rest
// sent when the attempt ends make one trace, and sending one record twice sends the same spans.
import type { SubagentRun, SubagentUsage, TokenUsage, TranscriptEvent } from '@reeval/agents'
import { redactSecrets } from '../redact.ts'
import { sha256Hex } from '../sha256.ts'
import { clip } from '../text.ts'
import type { EvalRecord, HarnessDescriptor } from '../types.ts'
import type { RunSpan, SpanAttributes } from '../view/spans.ts'
import { traceIdOf } from './run.ts'

export type AgentSpan = RunSpan & {
  kind?: 'client'
  events?: Array<{ name: string; timeMs: number; attributes: SpanAttributes }>
}

export type AgentAttempt = {
  runId: string
  evalId: string
  key: string
  cell: string
  n: number
  harness: HarnessDescriptor
  record: EvalRecord
  /** The attempt's span in the run's trace. */
  attemptSpanId?: string
}

const message = (text: string) => clip(redactSecrets(text.split('\n')[0] ?? ''), 1000)

function usageAttributes(u: TokenUsage | null | undefined): SpanAttributes {
  if (!u) return {}
  const input = u.input + u.cacheRead + u.cacheWrite
  return {
    'gen_ai.usage.input_tokens': input,
    'gen_ai.usage.output_tokens': u.output,
    'gen_ai.usage.cache_read.input_tokens': u.cacheRead,
    'gen_ai.usage.cache_write.input_tokens': u.cacheWrite,
    'llm.token_count.prompt': input,
    'llm.token_count.completion': u.output,
    'llm.token_count.total': input + u.output,
    'llm.token_count.prompt_details.cache_read': u.cacheRead,
    'llm.token_count.prompt_details.cache_write': u.cacheWrite,
    ...(u.reasoning !== null && {
      'gen_ai.usage.reasoning.output_tokens': u.reasoning,
      'llm.token_count.completion_details.reasoning': u.reasoning,
    }),
  }
}

function sum(usages: Array<TokenUsage | null>): TokenUsage | null {
  const known = usages.filter((u): u is TokenUsage => !!u)
  if (!known.length) return null
  return known.reduce((a, u) => ({
    input: a.input + u.input,
    output: a.output + u.output,
    cacheRead: a.cacheRead + u.cacheRead,
    cacheWrite: a.cacheWrite + u.cacheWrite,
    reasoning: a.reasoning === null || u.reasoning === null ? null : a.reasoning + u.reasoning,
  }))
}

/** A spawn call's attributes: the subagents it started (one per id, or `<id>#<i>` for each of several) and their own tokens. */
function spawnAttributes(runs: SubagentRun[]): SpanAttributes {
  const [only] = runs
  if (!only) return {}
  const usage = runs.every((r) => r.usage) ? sum(runs.map((r) => r.usage)) : null
  return {
    'reeval.subagents': runs.length,
    ...(runs.length === 1 && {
      ...(only.agent && { 'reeval.subagent.agent': only.agent }),
      ...(only.model && { 'reeval.subagent.model': only.model }),
      ...(only.status && { 'reeval.subagent.status': only.status }),
    }),
    ...(usage ? usageAttributes(usage) : { 'reeval.usage.unreported': true }),
  }
}

/** The attempt's `subagentUsage`: `unknown` where any turn's is, else `missing` where any is. */
function attemptSubagentUsage(turns: Array<{ subagentUsage?: SubagentUsage }>) {
  const all = turns.flatMap((t) => (t.subagentUsage ? [t.subagentUsage] : []))
  return all.find((u) => u === 'unknown') ?? all.find((u) => u === 'missing') ?? all[0]
}

const TOOL_NAME: Partial<Record<TranscriptEvent['type'], string>> = {
  'file-edit': 'file-edit',
  'web-search': 'web-search',
  'web-fetch': 'web-fetch',
}

/** The attempt's trace id, and each span's id from what it is, so a span sent early and the rest sent later agree. */
function idsOf(o: AgentAttempt) {
  const { record } = o
  const started = record.startedAt ?? record.turns[0]?.startedAt ?? ''
  const traceId = sha256Hex(`reeval-agent:${o.runId}:${o.key}:${started}`).slice(0, 32)
  const spanId = (what: string) => sha256Hex(`${traceId}:${what}`).slice(0, 16)
  return { started, traceId, spanId, rootId: spanId('root') }
}

const commonOf = (o: AgentAttempt) => ({ 'session.id': o.runId, 'reeval.run.id': o.runId })

type Parts = { turn: boolean; tools: boolean; chat: boolean }

function turnSpans(o: AgentAttempt, i: number, parts: Parts): AgentSpan[] {
  const turn = o.record.turns[i]
  if (!turn) return []
  const { traceId, spanId, rootId } = idsOf(o)
  const common = commonOf(o)
  const spans: AgentSpan[] = []
  const turnStart = Date.parse(turn.startedAt)
  const turnId = spanId(`turn:${i}`)
  const turnEnd = turnStart + turn.durationMs
  // A subagent's calls nest under the first span of the call that spawned it; one call can
  // record several events (one per file it edits), and each still needs its own span id.
  const toolId = (callId: string, k: number) => spanId(`turn:${i}:tool:${callId}:${k}`)
  const seen = new Map<string, number>()
  const toolCalls = new Set(
    turn.transcript.flatMap((e) => ('toolCallId' in e ? [e.toolCallId] : [])),
  )
  const turnEvents: NonNullable<AgentSpan['events']> = []
  let calls = 0
  for (const e of turn.transcript) {
    const startMs = turnStart + e.atMs
    if (e.type === 'error' || e.type === 'retry') {
      turnEvents.push({
        name: e.type === 'error' ? 'exception' : 'reeval.retry',
        timeMs: startMs,
        attributes: { 'exception.message': message(e.message) },
      })
    } else if (e.type === 'model-call') {
      const id = spanId(`turn:${i}:chat:${calls++}`)
      if (!parts.chat) continue
      const model = e.model ?? turn.model
      const failed = e.status === null || e.status >= 400
      spans.push({
        traceId,
        spanId: id,
        parentSpanId: turnId,
        name: `chat${model ? ` ${model}` : ''}`,
        kind: 'client',
        startMs,
        endMs: startMs + e.durationMs,
        attributes: {
          ...common,
          'gen_ai.operation.name': 'chat',
          'openinference.span.kind': 'LLM',
          ...(model && { 'gen_ai.response.model': model, 'llm.model_name': model }),
          ...(e.firstByteMs !== null && {
            'gen_ai.response.time_to_first_chunk': e.firstByteMs / 1000,
          }),
          ...(e.status !== null && { 'http.response.status_code': e.status }),
          'reeval.model_call.role': e.role ?? 'main',
          ...(e.stream && { 'reeval.model_call.stream': true }),
          ...usageAttributes(e.usage),
        },
        ...(failed && {
          status: {
            code: 'error' as const,
            message: e.status ? `HTTP ${e.status}` : 'no response',
          },
        }),
      })
    } else if ('toolCallId' in e && parts.tools) {
      const tool = e.type === 'tool' ? e.tool : (TOOL_NAME[e.type] ?? e.type)
      const ok = 'ok' in e ? e.ok : undefined
      const k = seen.get(e.toolCallId) ?? 0
      seen.set(e.toolCallId, k + 1)
      const spawned =
        k === 0
          ? (turn.subagents ?? []).filter(
              (r) => r.id === e.toolCallId || r.id.startsWith(`${e.toolCallId}#`),
            )
          : []
      const spawner = e.subagent && toolCalls.has(e.subagent)
      spans.push({
        traceId,
        spanId: toolId(e.toolCallId, k),
        parentSpanId: spawner ? toolId(e.subagent as string, 0) : turnId,
        name: `execute_tool ${tool}`,
        startMs,
        endMs: startMs + (e.durationMs ?? 0),
        attributes: {
          ...common,
          'gen_ai.operation.name': 'execute_tool',
          'openinference.span.kind': 'TOOL',
          'gen_ai.tool.name': tool,
          'tool.name': tool,
          'gen_ai.tool.call.id': e.toolCallId,
          ...(e.type === 'file-edit' && { 'reeval.file_edit.kind': e.kind }),
          ...(e.subagent && { 'reeval.subagent': e.subagent }),
          ...spawnAttributes(spawned),
          ...(e.durationMs === null && { 'reeval.duration.unknown': true }),
          ...(e.durationInferred && { 'reeval.duration.inferred': true }),
        },
        ...(ok === false && { status: { code: 'error' as const } }),
      })
    }
  }
  if (!parts.turn) return spans
  const failure = turn.transcript.find((e) => e.type === 'error')
  spans.push({
    traceId,
    spanId: turnId,
    parentSpanId: rootId,
    name: `turn ${i + 1}`,
    startMs: turnStart,
    endMs: turnEnd,
    attributes: {
      ...common,
      'openinference.span.kind': 'CHAIN',
      'reeval.turn.n': i + 1,
      'reeval.turn.status': turn.status,
      ...(turn.model && { 'gen_ai.response.model': turn.model, 'llm.model_name': turn.model }),
      ...(turn.cost && {
        'llm.cost.total': turn.cost.usd,
        'reeval.cost.usd': turn.cost.usd,
        'reeval.cost.basis': turn.cost.basis,
      }),
      ...(turn.usage === null && { 'reeval.usage.unreported': true }),
      ...(turn.subagentUsage && { 'reeval.subagent_usage': turn.subagentUsage }),
      ...usageAttributes(turn.usage),
    },
    ...(turn.status !== 'completed' && {
      status: {
        code: 'error' as const,
        message: failure?.type === 'error' ? message(failure.message) : turn.status,
      },
    }),
    ...(turnEvents.length && { events: turnEvents }),
  })
  return spans
}

/**
 * Turn `i`'s span and its tool calls' as soon as the turn ends, or none when a tool call's
 * duration is only inferred at the attempt's end, from model calls the gateway may still be timing.
 */
export function finishedTurnSpans(o: AgentAttempt, i: number): AgentSpan[] {
  const turn = o.record.turns[i]
  if (!turn || turn.transcript.some((e) => 'toolCallId' in e && e.durationMs === null)) return []
  return turnSpans(o, i, { turn: true, tools: true, chat: false })
}

/** The agent span as the attempt starts, which the run ends as an error if the attempt's worker dies first. */
export function openAgentSpan(o: AgentAttempt): AgentSpan {
  const { harness } = o
  const { started, traceId, rootId } = idsOf(o)
  const startMs = started ? Date.parse(started) : Date.now()
  const requested = 'model' in harness && typeof harness.model === 'string' ? harness.model : null
  const effort = 'effort' in harness && typeof harness.effort === 'string' ? harness.effort : null
  return {
    traceId,
    spanId: rootId,
    name: `invoke_agent ${harness.kind}`,
    startMs,
    endMs: startMs,
    attributes: {
      ...commonOf(o),
      'gen_ai.operation.name': 'invoke_agent',
      'openinference.span.kind': 'AGENT',
      'gen_ai.agent.name': harness.kind,
      'gen_ai.conversation.id': o.key,
      ...(requested && { 'gen_ai.request.model': requested }),
      ...(effort && { 'gen_ai.request.reasoning.level': effort }),
      'reeval.eval.id': o.evalId,
      'reeval.attempt.key': o.key,
      'reeval.cell': o.cell,
      'reeval.attempt.n': o.n,
    },
    ...(o.attemptSpanId && {
      links: [{ traceId: traceIdOf(o.runId), spanId: o.attemptSpanId }],
    }),
  }
}

/** The attempt's spans from its finished record, but those of the turns in `sent`, whose model calls alone are left. */
export function agentSpans(o: AgentAttempt, sent: ReadonlySet<number> = new Set()): AgentSpan[] {
  const { record } = o
  const all = record.turns.flatMap((_, i) =>
    turnSpans(o, i, { turn: true, tools: true, chat: true }),
  )
  const spans = sent.size
    ? record.turns.flatMap((_, i) =>
        turnSpans(o, i, { turn: !sent.has(i), tools: !sent.has(i), chat: true }),
      )
    : all
  const open = openAgentSpan(o)
  const startMs = open.startMs
  const ends = record.turns.map((t) => Date.parse(t.startedAt) + t.durationMs)
  // Over every turn's spans, sent or not: a tool call can outlive its turn.
  const endMs = Math.max(startMs, ...ends, ...all.map((s) => s.endMs))
  const events: NonNullable<AgentSpan['events']> = []
  for (const x of record.assertions ?? []) {
    events.push({
      name: 'gen_ai.evaluation.result',
      timeMs: endMs,
      attributes: {
        'gen_ai.evaluation.name': clip(redactSecrets(x.label), 200),
        'gen_ai.evaluation.score.label': x.status,
        'gen_ai.evaluation.score.value':
          x.status === 'pass' ? 1 : x.status === 'not_applicable' ? 0.5 : 0,
        'reeval.evaluation.kind': 'check',
        'reeval.check.matcher': x.matcher,
      },
    })
  }
  for (const [i, j] of record.judgements.entries()) {
    events.push({
      name: 'gen_ai.evaluation.result',
      timeMs: endMs,
      attributes: {
        'gen_ai.evaluation.name': clip(
          redactSecrets(j.label ?? `judge #${(j.call ?? i) + 1}`),
          200,
        ),
        'gen_ai.evaluation.score.label': j.verdict,
        'gen_ai.evaluation.score.value': j.score,
        'reeval.evaluation.kind': 'judge',
        'reeval.judge.threshold': j.threshold,
        'reeval.judge.model': j.resolvedModel ?? j.model,
        ...(j.retries?.length && { 'reeval.judge.retries': j.retries.length }),
        ...usageAttributes(j.usage),
      },
    })
  }
  const served = record.servedModels?.[0] ?? record.turns.findLast((t) => t.model)?.model
  const costs = record.turns.flatMap((t) => (t.cost ? [t.cost.usd] : []))
  const failed = record.outcome === 'fail' || record.outcome === 'infra_error'
  const subagentUsage = attemptSubagentUsage(record.turns)
  spans.push({
    ...open,
    endMs,
    attributes: {
      ...open.attributes,
      ...(served && { 'gen_ai.response.model': served, 'llm.model_name': served }),
      'reeval.outcome': record.outcome,
      'reeval.turns': record.turns.length,
      ...(record.error && { 'reeval.error.kind': record.error.kind }),
      ...(costs.length === record.turns.length &&
        costs.length > 0 && {
          'llm.cost.total': costs.reduce((a, b) => a + b, 0),
          'reeval.cost.usd': costs.reduce((a, b) => a + b, 0),
        }),
      ...(subagentUsage && { 'reeval.subagent_usage': subagentUsage }),
      ...usageAttributes(sum(record.turns.map((t) => t.usage))),
    },
    ...(failed && {
      status: {
        code: 'error' as const,
        message: record.error ? message(record.error.message) : record.outcome,
      },
    }),
    ...(events.length && { events }),
  })
  return spans
}
