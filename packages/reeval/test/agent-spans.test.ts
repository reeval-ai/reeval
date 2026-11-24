// The agent export's spans for one attempt, from its record: parentage, real timings, token
// mapping, subagent nesting, evaluation events, no content, and ids that repeat for one record.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type AgentSpan, agentSpans } from '../src/trace/agent-spans.ts'
import { traceIdOf } from '../src/trace/run.ts'
import type { EvalRecord, HarnessDescriptor } from '../src/types.ts'

const T0 = Date.parse('2026-11-24T10:00:00.000Z')
const at = (ms: number) => new Date(T0 + ms).toISOString()
const usage = { input: 100, output: 20, cacheRead: 300, cacheWrite: 50, reasoning: 5 }

const record = {
  startedAt: at(0),
  outcome: 'fail',
  error: { kind: 'assertion', message: 'expected hello\nmore' },
  turns: [
    {
      prompt: 'SECRET PROMPT',
      text: 'SECRET ANSWER',
      status: 'completed',
      startedAt: at(1000),
      durationMs: 9000,
      usage,
      model: 'claude-x',
      unreported: [],
      cost: { usd: 0.25, basis: 'reported', source: 'claude-code' },
      transcript: [
        { type: 'reasoning', text: 'SECRET THOUGHT', durationMs: 10, ts: at(1100), atMs: 100 },
        {
          type: 'model-call',
          request: 'POST api.anthropic.com/v1/messages',
          status: 200,
          durationMs: 800,
          firstByteMs: 300,
          usage,
          model: 'claude-x',
          role: 'main',
          ts: at(1200),
          atMs: 200,
        },
        {
          type: 'tool',
          toolCallId: 'agent-1',
          tool: 'Agent',
          input: { prompt: 'SECRET INPUT' },
          output: 'SECRET OUTPUT',
          ok: true,
          durationMs: 4000,
          ts: at(2000),
          atMs: 1000,
        },
        {
          type: 'file-edit',
          toolCallId: 'edit-1',
          path: 'a.ts',
          kind: 'modify',
          added: 1,
          removed: 0,
          durationMs: null,
          subagent: 'agent-1',
          ts: at(2500),
          atMs: 1500,
        },
        { type: 'retry', message: 'overloaded', ts: at(3000), atMs: 2000 },
        {
          type: 'model-call',
          request: 'POST api.anthropic.com/v1/messages',
          status: 529,
          durationMs: 50,
          firstByteMs: null,
          usage: null,
          model: 'claude-haiku',
          role: 'side',
          ts: at(3100),
          atMs: 2100,
        },
      ],
    },
  ],
  judgements: [
    { verdict: 'pass', score: 0.9, threshold: 0.5, question: 'q', model: 'gemini', call: 0 },
  ],
  assertions: [
    { label: 'writes hello', labelled: true, matcher: 'toHaveFile', status: 'fail', soft: true },
  ],
} as unknown as EvalRecord

const build = () =>
  agentSpans({
    runId: 'run-1',
    evalId: 'e1',
    key: 'k1',
    cell: 'claude-code',
    n: 1,
    harness: { kind: 'claude-code', model: 'claude-x', effort: 'high' } as HarnessDescriptor,
    record,
    attemptSpanId: 'f'.repeat(16),
  })

const byName = (spans: AgentSpan[], prefix: string) =>
  spans.filter((s) => s.name.startsWith(prefix))

test('one trace per attempt: the agent, its turns, and their model and tool calls', () => {
  const spans = build()
  const [root] = byName(spans, 'invoke_agent')
  const [turn] = byName(spans, 'turn')
  assert.ok(root && turn)
  assert.ok(spans.every((s) => s.traceId === root.traceId))
  assert.equal(root.name, 'invoke_agent claude-code')
  assert.equal(root.parentSpanId, undefined)
  assert.deepEqual(root.links, [{ traceId: traceIdOf('run-1'), spanId: 'f'.repeat(16) }])
  assert.equal(turn.parentSpanId, root.spanId)
  assert.deepEqual([turn.startMs, turn.endMs], [T0 + 1000, T0 + 10_000])
  const [chat, side] = byName(spans, 'chat')
  assert.equal(chat?.parentSpanId, turn.spanId)
  assert.equal(chat?.kind, 'client')
  assert.deepEqual([chat?.startMs, chat?.endMs], [T0 + 1200, T0 + 2000])
  assert.equal(chat?.attributes['gen_ai.response.time_to_first_chunk'], 0.3)
  assert.equal(side?.attributes['reeval.model_call.role'], 'side')
  assert.deepEqual(side?.status, { code: 'error', message: 'HTTP 529' })
  const [agentTool, edit] = byName(spans, 'execute_tool')
  assert.equal(agentTool?.name, 'execute_tool Agent')
  assert.equal(edit?.name, 'execute_tool file-edit')
  assert.equal(edit?.parentSpanId, agentTool?.spanId, "a subagent's call nests under its spawn")
  assert.equal(edit?.startMs, edit?.endMs)
  assert.equal(edit?.attributes['reeval.duration.unknown'], true)
  assert.deepEqual(
    turn.events?.map((e) => e.name),
    ['reeval.retry'],
  )
})

test('tokens follow the GenAI conventions, with cache reads and writes inside input', () => {
  const [root] = byName(build(), 'invoke_agent')
  assert.ok(root)
  assert.equal(root.attributes['gen_ai.usage.input_tokens'], 450)
  assert.equal(root.attributes['gen_ai.usage.cache_read.input_tokens'], 300)
  assert.equal(root.attributes['gen_ai.usage.cache_write.input_tokens'], 50)
  assert.equal(root.attributes['gen_ai.usage.output_tokens'], 20)
  assert.equal(root.attributes['gen_ai.usage.reasoning.output_tokens'], 5)
  assert.equal(root.attributes['llm.token_count.total'], 470)
  assert.equal(root.attributes['llm.cost.total'], 0.25)
  assert.equal(root.attributes['gen_ai.request.model'], 'claude-x')
  assert.equal(root.attributes['gen_ai.request.reasoning.level'], 'high')
  assert.equal(root.attributes['session.id'], 'run-1')
  assert.equal(root.attributes['reeval.outcome'], 'fail')
  assert.deepEqual(root.status, { code: 'error', message: 'expected hello' })
})

test('each check and judgment is a gen_ai.evaluation.result event on the agent span', () => {
  const [root] = byName(build(), 'invoke_agent')
  assert.deepEqual(
    root?.events?.map((e) => [
      e.name,
      e.attributes['gen_ai.evaluation.name'],
      e.attributes['gen_ai.evaluation.score.label'],
      e.attributes['gen_ai.evaluation.score.value'],
      e.attributes['reeval.evaluation.kind'],
    ]),
    [
      ['gen_ai.evaluation.result', 'writes hello', 'fail', 0, 'check'],
      ['gen_ai.evaluation.result', 'judge #1', 'pass', 0.9, 'judge'],
    ],
  )
})

test('no prompt, answer, reasoning or tool input and output is sent', () => {
  assert.doesNotMatch(JSON.stringify(build()), /SECRET/)
})

test('one record gives the same ids each time, and a retry of the attempt another trace', () => {
  assert.deepEqual(build(), build())
  const retried = agentSpans({
    runId: 'run-1',
    evalId: 'e1',
    key: 'k1',
    cell: 'claude-code',
    n: 1,
    harness: { kind: 'claude-code' } as HarnessDescriptor,
    record: { ...record, startedAt: at(60_000) },
  })
  assert.notEqual(retried[0]?.traceId, build()[0]?.traceId)
})
