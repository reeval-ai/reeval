import { defineEnvironment, defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'
import { fakeDecisionModel } from 'reeval/testing'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const plain = defineEnvironment('plain', { sandbox })

/** Answers whether the diff it's shown adds the app, as a decision model would. */
export const model = fakeDecisionModel(({ state }) => ({
  done: { type: 'boolean', probability: JSON.stringify(state).includes('answer = 42') ? 0.9 : 0.1 },
}))

export const questions = {
  done: { type: 'boolean', instructions: 'Did the agent write the app?' },
} as const

/** Whether the task sent the second turn its decision called for. */
export const noted = defineGrader('noted', {
  grade: (c) => c.turns.length,
  score: (turns) => (turns === 2 ? 1 : 0),
})
