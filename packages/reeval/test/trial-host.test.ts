// The trial host: a `decide` call's capture and inputs parts reach `c.decide` as `c.part` and
// `c.state` make them, and a turn the trial doesn't have, or a request it can't check, is a
// usage error.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TrialRequest } from '../src/contract/trial.ts'
import { replyToTrial } from '../src/language-runner/trial-host.ts'
import type { TrialContext, Turn } from '../src/types.ts'

const first = { prompt: 'one', text: 'One.' } as Turn
const second = { prompt: 'two', text: 'Two.' } as Turn

test("a decide whose inputs are on a turn the trial doesn't have is a usage error", async () => {
  let decided = 0
  const decide = (turns: Turn[]) =>
    replyToTrial(
      {
        turns,
        state: async () => [],
        decide: async () => void decided++,
      } as unknown as TrialContext,
      new Map(),
      {
        id: '1',
        call: {
          op: 'decide',
          model: 'typesafe-ai/jev',
          state: [{ type: 'inputs', diff: true, on: { turn: 1 } }],
          questions: { done: { type: 'boolean', instructions: 'Done?' } },
        },
      } as TrialRequest,
    )
  assert.deepEqual(await decide([first]), {
    id: '1',
    ok: false,
    op: 'decide',
    error: { name: 'UsageError', message: "c.state()'s on is turn 1, but the trial has 1 turns" },
  })
  assert.equal(decided, 0, 'the model never ran')
})

test('a value too deep to check is a usage error, not a lost reply', async () => {
  const c = {} as TrialContext
  let value: unknown = 1
  for (let i = 0; i < 200_000; i++) value = [value]
  const reply = await replyToTrial(c, new Map(), {
    id: '1',
    call: { op: 'observe', name: 'deep', value },
  } as TrialRequest)
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
  } as unknown as TrialContext
  const reply = await replyToTrial(c, new Map(), {
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
  } as TrialRequest)
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
