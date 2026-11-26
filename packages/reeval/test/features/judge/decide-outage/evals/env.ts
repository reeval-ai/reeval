import { defineEnvironment } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'
import { fakeDecisionModel } from 'reeval/testing'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const app = defineEnvironment('app', { sandbox })

/** A decision model whose provider fails every call, as it would after the AI SDK's retries. */
export const outage = fakeDecisionModel({}, { fail: 'overloaded' })

export const questions = {
  done: { type: 'boolean', instructions: 'Did the agent write the app?' },
} as const

export const answering = fakeDecisionModel({ done: { type: 'boolean', probability: 0.9 } })
