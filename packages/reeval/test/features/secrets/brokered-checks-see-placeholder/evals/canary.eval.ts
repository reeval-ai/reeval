import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { keys } from './env.ts'

// Must fail: the checks don't get the host value either.
export default defineEval({
  environment: keys,
  graders: [observed('sees-host-value')],
  task: async (c) => {
    const seen = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    c.observe('checks-saw', seen)
    c.observe('sees-host-value', seen === process.env.REEVAL_FIXTURE_TOKEN)
  },
})
