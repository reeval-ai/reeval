import { defineEval } from 'reeval'
import { agentPrinted, listed } from './env.ts'

// Must fail: the request was refused.
export default defineEval({
  environment: listed,
  graders: [
    agentPrinted('not-refused', ([body]) => !body?.includes('blocked by the reeval egress policy')),
  ],
  task: async (c) => {
    await c.send('fetch an unlisted host')
  },
})
