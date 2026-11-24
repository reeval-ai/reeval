// One attempt as the agent export's trace, from its finished record: what the agent did, in the
// OpenTelemetry GenAI conventions with OpenInference's attributes beside them, for LLM tracing
// tools. One trace per attempt, with the run as its session:
//
//   invoke_agent <harness>    the attempt (AGENT), with a gen_ai.evaluation.result event per check
//                             and per judgment, and a link to the attempt's span in the run's trace
//     turn <n>                each turn (CHAIN), with its errors and retries as events
//       chat <model>          each model call the egress gateway saw (LLM)
//       execute_tool <tool>   each tool call (TOOL); a subagent's calls under the call that spawned it
//
// No content: prompts, agent text, reasoning and tool input and output stay out. Ids come from the
// run, the attempt and its start, so sending one record twice sends the same spans.
import type { TokenUsage, TranscriptEvent } from '@reeval/agents'
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

const TOOL_NAME: Partial<Record<TranscriptEvent['type'], string>> = {
  'file-edit': 'file-edit',
  'web-search': 'web-search',
  'web-fetch': 'web-fetch',
}

export function agentSpans(o: AgentAttempt): AgentSpan[] {
  const { record, harness } = o
  const started = record.startedAt ?? record.turns[0]?.startedAt ?? ''
  const traceId = sha256Hex(`reeval-agent:${o.runId}:${o.key}:${started}`).slice(0, 32)
  let ids = 0
  const spanId = () => sha256Hex(`${traceId}:${ids++}`).slice(0, 16)
  const rootId = spanId()
  const spans: AgentSpan[] = []
  const common = { 'session.id': o.runId, 'reeval.run.id': o.runId }
  const requested = 'model' in harness && typeof harness.model === 'string' ? harness.model : null
  const effort = 'effort' in harness && typeof harness.effort === 'string' ? harness.effort : null

  for (const [i, turn] of record.turns.entries()) {
    const turnStart = Date.parse(turn.startedAt)
    const turnId = spanId()
    const turnEnd = turnStart + turn.durationMs
    // A subagent's calls nest under the first span of the call that spawned it; one call can
    // record several events (one per file it edits), and each still needs its own span id.
    const toolSpans = new Map<string, string>()
    const claimed = new Set<string>()
    const turnEvents: NonNullable<AgentSpan['events']> = []
    const tools = turn.transcript.filter((e) => 'toolCallId' in e)
    for (const e of tools) toolSpans.set((e as { toolCallId: string }).toolCallId, spanId())
    for (const e of turn.transcript) {
      const startMs = turnStart + e.atMs
      if (e.type === 'error' || e.type === 'retry') {
        turnEvents.push({
          name: e.type === 'error' ? 'exception' : 'reeval.retry',
          timeMs: startMs,
          attributes: { 'exception.message': message(e.message) },
        })
      } else if (e.type === 'model-call') {
        const model = e.model ?? turn.model
        const failed = e.status === null || e.status >= 400
        spans.push({
          traceId,
          spanId: spanId(),
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
      } else if ('toolCallId' in e) {
        const tool = e.type === 'tool' ? e.tool : (TOOL_NAME[e.type] ?? e.type)
        const ok = 'ok' in e ? e.ok : undefined
        const own = claimed.has(e.toolCallId) ? spanId() : (toolSpans.get(e.toolCallId) as string)
        claimed.add(e.toolCallId)
        spans.push({
          traceId,
          spanId: own,
          parentSpanId: (e.subagent && toolSpans.get(e.subagent)) || turnId,
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
            ...(e.durationMs === null && { 'reeval.duration.unknown': true }),
            ...(e.durationInferred && { 'reeval.duration.inferred': true }),
          },
          ...(ok === false && { status: { code: 'error' as const } }),
        })
      }
    }
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
  }

  const firstStart = record.turns[0] ? Date.parse(record.turns[0].startedAt) : Date.now()
  const startMs = started ? Date.parse(started) : firstStart
  const ends = record.turns.map((t) => Date.parse(t.startedAt) + t.durationMs)
  const endMs = Math.max(startMs, ...ends, ...spans.map((s) => s.endMs))
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
  spans.push({
    traceId,
    spanId: rootId,
    name: `invoke_agent ${harness.kind}`,
    startMs,
    endMs,
    attributes: {
      ...common,
      'gen_ai.operation.name': 'invoke_agent',
      'openinference.span.kind': 'AGENT',
      'gen_ai.agent.name': harness.kind,
      'gen_ai.conversation.id': o.key,
      ...(requested && { 'gen_ai.request.model': requested }),
      ...(served && { 'gen_ai.response.model': served, 'llm.model_name': served }),
      ...(effort && { 'gen_ai.request.reasoning.level': effort }),
      'reeval.eval.id': o.evalId,
      'reeval.attempt.key': o.key,
      'reeval.cell': o.cell,
      'reeval.attempt.n': o.n,
      'reeval.outcome': record.outcome,
      'reeval.turns': record.turns.length,
      ...(record.error && { 'reeval.error.kind': record.error.kind }),
      ...(costs.length === record.turns.length &&
        costs.length > 0 && {
          'llm.cost.total': costs.reduce((a, b) => a + b, 0),
          'reeval.cost.usd': costs.reduce((a, b) => a + b, 0),
        }),
      ...usageAttributes(sum(record.turns.map((t) => t.usage))),
    },
    ...(failed && {
      status: {
        code: 'error' as const,
        message: record.error ? message(record.error.message) : record.outcome,
      },
    }),
    ...(o.attemptSpanId && {
      links: [{ traceId: traceIdOf(o.runId), spanId: o.attemptSpanId }],
    }),
    ...(events.length && { events }),
  })
  return spans
}
