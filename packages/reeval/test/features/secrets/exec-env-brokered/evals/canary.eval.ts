import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { keys } from './env.ts'

// Must fail: the command doesn't get the host value.
export default defineEval({
  environment: keys,
  graders: [observed('sees-host-value')],
  task: async (c) => {
    const env = { AUTH: `Bearer ${process.env.REEVAL_FIXTURE_TOKEN}` }
    const seen = (await c.exec('printf %s "$AUTH"', { env })).stdout
    c.observe('command-saw', seen)
    c.observe('sees-host-value', seen === `Bearer ${process.env.REEVAL_FIXTURE_TOKEN}`)
  },
})
