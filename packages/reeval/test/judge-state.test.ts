import assert from 'node:assert/strict'
import { test } from 'node:test'
import { judgeProblem } from '../src/contract/judge.ts'
import { withInputSize } from '../src/judge/size.ts'
import { type Draft, stateOf } from '../src/judge/state.ts'
import { mergeJudge, resolveStateOptions } from '../src/judge/state-options.ts'
import { transcriptForJudge } from '../src/judge/transcript.ts'
import type { TranscriptEvent } from '../src/types.ts'

const at = { at: '2026-10-17T00:00:00.000Z' } as const
const events = [
  { ...at, type: 'text', text: 'Looking at the tests.', durationMs: null },
  { ...at, type: 'reasoning', text: 'They probably use node:test.', durationMs: null },
  {
    ...at,
    type: 'tool',
    toolCallId: 't1',
    tool: 'shell',
    input: { command: 'npm test' },
    output: `14 passing\n${'x'.repeat(400)}`,
    ok: true,
    durationMs: 2100,
  },
  {
    ...at,
    type: 'file-edit',
    toolCallId: 't2',
    path: 'src/auth.ts',
    kind: 'modify',
    added: 31,
    removed: 4,
    durationMs: null,
  },
  {
    ...at,
    type: 'file-edit',
    toolCallId: 't5',
    path: 'notes.txt',
    kind: 'write',
    added: 2,
    removed: null,
    durationMs: null,
  },
  {
    ...at,
    type: 'web-fetch',
    toolCallId: 't3',
    url: 'https://example.com/a',
    ok: false,
    durationMs: null,
  },
  {
    ...at,
    type: 'web-search',
    toolCallId: 't4',
    query: 'firebase auth',
    references: 3,
    durationMs: null,
  },
  {
    ...at,
    type: 'tool',
    toolCallId: 't6',
    tool: 'read',
    input: { path: 'notes.txt' },
    output: null,
    ok: null,
    durationMs: null,
  },
  { ...at, type: 'error', message: 'rate limited' },
] as unknown as TranscriptEvent[]

test('the transcript renders one compact entry per event, by mode', () => {
  const tools = transcriptForJudge(events, 'tools')
  assert.deepEqual(
    tools.map((l) => l.split('\n')[0]),
    [
      'tool shell: npm test → ok · 2s',
      'edit src/auth.ts (modify, +31 −4)',
      'edit notes.txt (write, +2)',
      'fetch https://example.com/a → failed',
      'search "firebase auth" → ok',
      'tool read: notes.txt → unfinished',
      'error: rate limited',
    ],
  )
  assert.ok((tools[0]?.length ?? 0) < 340, 'tool output is clipped')
  const messages = transcriptForJudge(events, true)
  assert.equal(messages[0], 'message: Looking at the tests.')
  assert.ok(!messages.some((l) => l.startsWith('reasoning:')), 'no reasoning without full')
  const full = transcriptForJudge(events, 'full')
  assert.equal(full[1], 'reasoning: They probably use node:test.')
  assert.ok(full[2]?.includes('x'.repeat(400)), 'full leaves tool output whole')
})

test("a call's inputs resolve every key, off unless it turns it on", () => {
  assert.deepEqual(resolveStateOptions({ contents: ['src/**'] }), {
    task: false,
    output: false,
    files: false,
    diff: false,
    contents: ['src/**'],
    transcript: false,
    turns: 'last',
    checks: false,
  })
  assert.deepEqual(resolveStateOptions({ diff: true, turns: 'all' }).turns, 'all')
  assert.deepEqual(mergeJudge({ maxConcurrent: 2 }, { maxConcurrent: 4 }), { maxConcurrent: 4 })
  assert.deepEqual(mergeJudge({ maxConcurrent: 2, model: 'google/g' }, { model: 'openai/o' }), {
    maxConcurrent: 2,
    model: 'openai/o',
  })
})

test('judge options leave the inputs to a judge grader', () => {
  const loc = { at: 'options', where: 'evals/a.eval.ts › lands' } as const
  assert.equal(
    judgeProblem({ diff: ['src/'] }, loc),
    `Unknown judge option "diff" in evals/a.eval.ts › lands. diff is a judge grader's input: judge(question, { inputs: { diff } }).`,
  )
  assert.equal(
    judgeProblem({ gatewy: 'vercel' }, loc),
    'Unknown judge option "gatewy" in evals/a.eval.ts › lands. Did you mean "gateway"?',
  )
  assert.equal(
    judgeProblem({ on: 'x' }, loc),
    'Unknown judge option "on" in evals/a.eval.ts › lands.',
  )
  assert.equal(
    judgeProblem({ state: { diff: true } }, loc),
    'Unknown judge option "state" in evals/a.eval.ts › lands.',
  )
})

test("each subagent's events show under its spawn call, and a view picks whose", () => {
  const sub: TranscriptEvent[] = [
    { type: 'text', text: 'Reviewing it.', at: 1 },
    {
      type: 'tool',
      toolCallId: 's1',
      tool: 'Agent',
      kind: 'tool',
      input: { prompt: 'review x.ts' },
      output: 'x.ts is fine',
      ok: true,
      startedAt: 1,
      durationMs: 3000,
    },
    { type: 'text', text: 'looking at x.ts', subagent: 's1', at: 2 },
    {
      type: 'file-edit',
      toolCallId: 'e1',
      tool: 'Edit',
      path: 'x.ts',
      kind: 'update',
      added: 1,
      removed: 0,
      startedAt: 2,
      durationMs: 5,
      subagent: 's1',
    },
    { type: 'text', text: 'Done.', at: 3 },
  ] as TranscriptEvent[]
  const runs = [
    {
      id: 's1',
      n: 1,
      agent: 'reviewer',
      model: 'claude-haiku-4-5',
      prompt: 'review x.ts',
      status: 'completed' as const,
      durationMs: 3000,
      events: 'streamed' as const,
      finalMessage: 'x.ts is fine',
    },
  ]
  assert.deepEqual(transcriptForJudge(sub, true, runs), [
    'message: Reviewing it.',
    'tool Agent: {"prompt":"review x.ts"} → ok · 3s\n  x.ts is fine',
    'subagent 1 (reviewer, claude-haiku-4-5, completed, 3s):\n  message: looking at x.ts\n  edit x.ts (update, +1 −0) · 5ms',
    'message: Done.',
  ])
  assert.deepEqual(transcriptForJudge(sub, { subagents: false }, runs), [
    'message: Reviewing it.',
    'tool Agent: {"prompt":"review x.ts"} → ok · 3s\n  x.ts is fine',
    'message: Done.',
  ])
  assert.deepEqual(transcriptForJudge(sub, { agent: false, detail: 'tools' }, runs), [
    'subagent 1 (reviewer, claude-haiku-4-5, completed, 3s):\n  task: review x.ts\n  edit x.ts (update, +1 −0) · 5ms\n  final message: x.ts is fine',
  ])
  const none = [{ ...runs[0], events: 'none' as const }]
  assert.deepEqual(transcriptForJudge(sub.slice(0, 2), 'tools', none), [
    'tool Agent: {"prompt":"review x.ts"} → ok · 3s\n  x.ts is fine',
    "subagent 1 (reviewer, claude-haiku-4-5, completed, 3s):\n  (its own actions aren't in the transcript; the diff has what it changed)",
  ])
})

const patch = (path: string, body: string) =>
  `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1 @@\n+${body}\n`

test("a provider error keeps the provider's message and names the inputs that were on, largest first", () => {
  const state = stateOf({
    all: false,
    turns: [{ task: 'do it', output: 'done', transcript: 't'.repeat(8000) }],
    files: ['added big.ts'],
    diff: patch('big.ts', 'b'.repeat(20_000)),
  })
  const message = withInputSize('{"error_type":"max_tokens_exceeded"}', state, 'ok?')
  const [provider, hint, ...rest] = message.split('\n')
  assert.equal(provider, '{"error_type":"max_tokens_exceeded"}')
  assert.deepEqual(rest, [])
  assert.match(
    hint ?? '',
    /^The judge's input was ~7k tokens \(estimated\): diff 5k, of which big\.ts is 5k; transcript 2k\. Narrow diff, transcript, files, task or output\.$/,
  )
})

test("turns: 'all' puts each turn under turns; the graded turn's keys are at the top otherwise", () => {
  const two: Draft = {
    all: true,
    turns: [
      { task: 'one', output: 'a' },
      { task: 'two', output: 'b' },
    ],
    files: [],
  }
  assert.deepEqual(stateOf(two), {
    turns: [
      { task: 'one', output: 'a' },
      { task: 'two', output: 'b' },
    ],
    files: [],
  })
  assert.deepEqual(Object.keys(stateOf({ ...two, all: false })), ['task', 'output', 'files'])
})
