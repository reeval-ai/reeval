import { defineEval } from 'reeval'
import { missing } from './env.ts'

// A setup step that can't start is an infra error: the tally counts it apart from the fails.
export default defineEval({
  environment: missing,
  task: async (c) => {
    await c.exec('true')
  },
})
