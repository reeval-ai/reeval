import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { tokens } from './env.ts'

// A `to: 'checks'` secret reaches c.exec, with the host variable's value.
export default defineEval({
  environment: tokens,
  graders: [observed('sees-host-value')],
  task: async (c) => {
    const seen = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    c.observe('sees-host-value', seen === process.env.REEVAL_FIXTURE_TOKEN)
  },
})
