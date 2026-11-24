// The agent export's spans for one attempt, from its record: parentage, real timings, token
// mapping, subagent nesting, evaluation events, no content, and ids that repeat for one record.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agentRelay } from '../src/trace/agent-relay.ts'
import {
  type AgentSpan,
  agentSpans,
  finishedTurnSpans,
  openAgentSpan,
} from '../src/trace/agent-spans.ts'
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
      subagentUsage: 'counted',
      subagents: [
        {
          id: 'agent-1',
          agent: 'general-purpose',
          model: 'claude-haiku',
          prompt: 'SECRET INPUT',
          status: 'completed',
          durationMs: 4000,
          events: 'streamed',
          usage: { input: 10, output: 2, cacheRead: 30, cacheWrite: 0, reasoning: 0 },
        },
      ],
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

const attempt = (r: EvalRecord = record) => ({
  runId: 'run-1',
  evalId: 'e1',
  key: 'k1',
  cell: 'claude-code',
  n: 1,
  harness: { kind: 'claude-code', model: 'claude-x', effort: 'high' } as HarnessDescriptor,
  record: r,
  attemptSpanId: 'f'.repeat(16),
})
const build = () => agentSpans(attempt())

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

test('one call that records several events gives each its own span id', () => {
  const edit = (path: string, atMs: number) => ({
    type: 'file-edit',
    toolCallId: 'apply-1',
    path,
    kind: 'modify',
    added: 1,
    removed: 0,
    durationMs: 5,
    ts: at(1000 + atMs),
    atMs,
  })
  const [turn] = record.turns
  const spans = agentSpans({
    runId: 'run-1',
    evalId: 'e1',
    key: 'k1',
    cell: 'opencode',
    n: 1,
    harness: { kind: 'opencode' } as HarnessDescriptor,
    record: {
      ...record,
      turns: [{ ...turn, transcript: [edit('a.ts', 10), edit('b.ts', 20)] }],
    } as unknown as EvalRecord,
  })
  const ids = spans.map((s) => s.spanId)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(byName(spans, 'execute_tool').length, 2)
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

test("a spawn call carries its subagent's own tokens; the turn and agent say whether usage counts them", () => {
  const spans = build()
  const [agentTool, edit] = byName(spans, 'execute_tool')
  assert.equal(agentTool?.attributes['reeval.subagents'], 1)
  assert.equal(agentTool?.attributes['reeval.subagent.agent'], 'general-purpose')
  assert.equal(agentTool?.attributes['reeval.subagent.model'], 'claude-haiku')
  assert.equal(agentTool?.attributes['reeval.subagent.status'], 'completed')
  assert.equal(agentTool?.attributes['gen_ai.usage.input_tokens'], 40)
  assert.equal(agentTool?.attributes['gen_ai.usage.output_tokens'], 2)
  assert.equal(edit?.attributes['reeval.subagents'], undefined, 'only the spawn call has them')
  assert.equal(byName(spans, 'turn')[0]?.attributes['reeval.subagent_usage'], 'counted')
  assert.equal(byName(spans, 'invoke_agent')[0]?.attributes['reeval.subagent_usage'], 'counted')
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

test("a turn's span and its tool calls' as it ends, then the rest at the end, are the whole trace", () => {
  const [turn] = record.turns as unknown as Array<{ transcript: Array<Record<string, unknown>> }>
  const timed = {
    ...record,
    turns: [
      {
        ...turn,
        transcript: turn?.transcript.map((e) =>
          e.durationMs === null ? { ...e, durationMs: 5 } : e,
        ),
      },
    ],
  } as unknown as EvalRecord
  const live = finishedTurnSpans(attempt(timed), 0)
  assert.deepEqual(
    live.map((s) => s.name),
    ['execute_tool Agent', 'execute_tool file-edit', 'turn 1'],
  )
  const rest = agentSpans(attempt(timed), new Set([0]))
  assert.deepEqual(
    rest.map((s) => s.name),
    ['chat claude-x', 'chat claude-haiku', 'invoke_agent claude-code'],
  )
  const byId = (spans: AgentSpan[]) => spans.toSorted((a, b) => a.spanId.localeCompare(b.spanId))
  assert.deepEqual(byId([...live, ...rest]), byId(agentSpans(attempt(timed))))
})

test("a turn with a tool call whose duration is only inferred later waits for the attempt's end", () => {
  assert.deepEqual(finishedTurnSpans(attempt(), 0), [])
})

test("the run ends an attempt's agent span as an error when its worker exits first, and only then", () => {
  const sent: AgentSpan[] = []
  const relay = agentRelay((span) => sent.push(span))
  const open = openAgentSpan(attempt())
  relay.call('1', { open })
  relay.call('2', { open: { ...open, spanId: 'b'.repeat(16) } })
  relay.call('2', [{ ...open, spanId: 'b'.repeat(16) }])
  relay.released('2', 'signal SIGKILL')
  assert.equal(sent.length, 1, 'an attempt that ended is not ended again')
  relay.released('1', 'exit code 1')
  const crashed = sent[1]
  assert.equal(crashed?.spanId, build().at(-1)?.spanId, 'the same span the finished attempt sends')
  assert.equal(crashed?.name, 'invoke_agent claude-code')
  assert.deepEqual(crashed?.status, {
    code: 'error',
    message: 'The engine worker exited before the attempt ended (exit code 1)',
  })
  assert.equal(crashed?.attributes['reeval.outcome'], 'infra_error')
  relay.call('3', { open })
  relay.released('3')
  assert.equal(sent.length, 2, 'a worker that finished its file ends nothing')
})

test('the agent span ends with the last tool call, even one that outlived a turn sent as it ended', () => {
  const r = {
    startedAt: at(0),
    outcome: 'pass',
    error: null,
    judgements: [],
    turns: [
      {
        prompt: 'p',
        text: 't',
        status: 'completed',
        startedAt: at(1000),
        durationMs: 1000,
        usage: null,
        model: null,
        unreported: [],
        transcript: [
          {
            type: 'tool',
            toolCallId: 'bash-1',
            tool: 'bash',
            input: {},
            output: '',
            ok: true,
            durationMs: 5000,
            ts: at(1500),
            atMs: 500,
          },
        ],
      },
    ],
  } as unknown as EvalRecord
  const root = (spans: AgentSpan[]) => spans.find((s) => s.name.startsWith('invoke_agent'))
  assert.equal(finishedTurnSpans(attempt(r), 0).length, 2)
  assert.equal(root(agentSpans(attempt(r)))?.endMs, T0 + 6500)
  assert.equal(root(agentSpans(attempt(r), new Set([0])))?.endMs, T0 + 6500)
})

test("a canceled run's dead worker leaves its attempt's agent span canceled, not an infra error", () => {
  const sent: AgentSpan[] = []
  const relay = agentRelay(
    (span) => sent.push(span),
    () => true,
  )
  relay.call('1', { open: openAgentSpan(attempt()) })
  relay.released('1', 'signal SIGKILL')
  assert.equal(sent[0]?.attributes['reeval.outcome'], 'fail')
  assert.equal(sent[0]?.attributes['reeval.error.kind'], 'aborted')
  assert.deepEqual(sent[0]?.status, {
    code: 'error',
    message: 'The run was canceled (the engine worker exited: signal SIGKILL)',
  })
})
