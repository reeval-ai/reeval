import { defineEval } from 'reeval'
import { fromExec, thrower, tokens, value } from './env.ts'

// Must fail: the grader that throws the secret counts toward the score.
export default defineEval({
  environment: tokens,
  graders: [value, fromExec, thrower(1)],
  task: async (c) => {
    await c.exec('printf %s "$CHECK_TOKEN"')
  },
})
