import { defineEval } from 'reeval'
import { fromExec, thrower, tokens, value } from './env.ts'

// The secret is in a grade, an exec's stdout a grader returns and a grader's error; the
// record and every file hold it masked.
export default defineEval({
  environment: tokens,
  graders: [value, fromExec, thrower(0)],
  task: async (c) => {
    await c.exec('printf %s "$CHECK_TOKEN"')
  },
})
