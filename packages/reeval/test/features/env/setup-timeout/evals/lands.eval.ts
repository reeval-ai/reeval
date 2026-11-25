import { defineEval } from 'reeval'
import { slow } from './env.ts'

// A setup step over its own timeout is cut off: the attempt is an infra error naming the step
// (features.test.ts checks the message), and the eval body never runs.
export default defineEval({
  environment: slow,
  task: async (c) => {
    await c.exec('true')
    throw new Error('the eval body ran after a timed-out setup step')
  },
})
