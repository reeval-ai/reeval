import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { tokens } from './env.ts'

// Must fail: the checks aren't kept from the secret the way the agent is.
export default defineEval({
  environment: tokens,
  graders: [observed('checks-saw-nothing')],
  task: async (c) => {
    const seen = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    c.observe('checks-saw', seen)
    c.observe('checks-saw-nothing', seen === '')
  },
})
