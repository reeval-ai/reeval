import { defineEval } from 'reeval'
import { noBeacon, plain, prompt } from './env.ts'

// Must fail: the agent fetched the page, so its reply has the beacon's round and randomness.
export default defineEval({
  environment: plain,
  graders: [noBeacon],
  task: async (c) => {
    await c.send(prompt)
  },
})
