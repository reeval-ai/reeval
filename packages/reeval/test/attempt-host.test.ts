// The attempt host: the `judge` call's wire `JudgeOn` reaches `c.judge` as the turn or the value
// it names, as a TypeScript eval passes `on`, a `decide` call's capture and inputs parts reach
// `c.decide` as `c.part` and `c.state` make them, and a turn the attempt doesn't have, or a
// request it can't check, is a usage error.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AttemptRequest } from '../src/contract/attempt.ts'
import { replyToAttempt } from '../src/language-runner/attempt-host.ts'
import type { AttemptContext, JudgeCallOptions, Turn } from '../src/types.ts'

const verdict = { verdict: 'pass', score: 1, threshold: 0.8, question: 'q', model: 'fake' }

function attempt(turns: Turn[]) {
  const asked: (JudgeCallOptions | undefined)[] = []
  const c = {
    turns,
    judge: async (_question: string, options?: JudgeCallOptions) => {
      asked.push(options)
      return verdict
    },
  } as unknown as AttemptContext
  const judge = (options?: Record<string, unknown>) =>
    replyToAttempt(c, [], new Map(), {
      id: '1',
      call: { op: 'judge', question: 'q', ...(options ? { options } : {}) },
    } as AttemptRequest)
  return { asked, judge }
}

const first = { prompt: 'one', text: 'One.' } as Turn
const second = { prompt: 'two', text: 'Two.' } as Turn

test('judge on a value grades the value itself', async () => {
  const { asked, judge } = attempt([first])
  for (const value of ['Hello, Ada!', null, { exitCode: 0, stdout: 'ok' }, [1, 2]]) {
    assert.deepEqual(await judge({ on: { value }, threshold: 0.5 }), {
      id: '1',
      ok: true,
      op: 'judge',
      verdict,
    })
    assert.deepEqual(asked.pop(), { on: value, threshold: 0.5 })
  }
})

test('judge on a turn grades that turn of the attempt', async () => {
  const { asked, judge } = attempt([first, second])
  await judge({ on: { turn: 0 } })
  assert.equal(asked.pop()?.on, first)
  await judge({ diff: true })
  assert.deepEqual(asked.pop(), { diff: true })
})

test("judge on a turn the attempt doesn't have is a usage error", async () => {
  const { asked, judge } = attempt([first])
  assert.deepEqual(await judge({ on: { turn: 1 } }), {
    id: '1',
    ok: false,
    op: 'judge',
    error: { name: 'UsageError', message: "c.judge()'s on is turn 1, but the attempt has 1 turn" },
  })
  assert.equal(asked.length, 0, 'the judge never ran')
  const none = attempt([])
  assert.equal(
    ((await none.judge({ on: { turn: 0 } })) as { error: { message: string } }).error.message,
    "c.judge()'s on is turn 0, but the attempt has 0 turns",
  )
})

test('a value too deep to check is a usage error, not a lost reply', async () => {
  const c = {} as AttemptContext
  let value: unknown = 1
  for (let i = 0; i < 200_000; i++) value = [value]
  const reply = await replyToAttempt(c, [], new Map(), {
    id: '1',
    call: { op: 'observe', name: 'deep', value },
  } as AttemptRequest)
  assert.equal(reply.ok, false)
  assert.match(
    (reply as { error: { message: string } }).error.message,
    /couldn't be checked: Maximum call stack size exceeded/,
  )
})

test("decide makes its state's capture and inputs parts as c.part and c.state do", async () => {
  const calls: unknown[] = []
  const c = {
    turns: [first, second],
    part: (name: string) => ({ type: 'file', mediaType: 'image/png', data: `png:${name}` }),
    state: async (inputs: Record<string, unknown>) => [{ type: 'json', value: { inputs } }],
    decide: async (call: unknown) => {
      calls.push(call)
      return {
        answers: { done: { type: 'boolean', probability: 0.9 } },
        usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
        warnings: [],
        providerMetadata: undefined,
        response: { modelId: 'jev', timestamp: new Date(0) },
      }
    },
  } as unknown as AttemptContext
  const reply = await replyToAttempt(c, [], new Map(), {
    id: '1',
    call: {
      op: 'decide',
      model: 'typesafe-ai/jev',
      state: [
        { type: 'text', text: 'Is it done?' },
        { type: 'inputs', diff: true, on: { turn: 0 } },
        { type: 'capture', name: 'home' },
      ],
      questions: { done: { type: 'boolean', instructions: 'Done?' } },
    },
  } as AttemptRequest)
  assert.deepEqual(calls, [
    {
      model: 'typesafe-ai/jev',
      questions: { done: { type: 'boolean', instructions: 'Done?' } },
      state: [
        { type: 'text', text: 'Is it done?' },
        { type: 'json', value: { inputs: { diff: true, on: first } } },
        { type: 'file', mediaType: 'image/png', data: 'png:home' },
      ],
    },
  ])
  assert.deepEqual(reply, {
    id: '1',
    ok: true,
    op: 'decide',
    result: {
      answers: { done: { type: 'boolean', probability: 0.9 } },
      usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
      warnings: [],
      response: { modelId: 'jev', timestamp: '1970-01-01T00:00:00.000Z' },
    },
  })
})
