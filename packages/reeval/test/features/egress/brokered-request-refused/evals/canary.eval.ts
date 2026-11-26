import { defineEval } from 'reeval'
import { agentPrinted, brokered } from './env.ts'

// Must fail: the request was refused.
export default defineEval({
  environment: brokered,
  graders: [
    agentPrinted('not-refused', ([body]) => !body?.includes('carries a brokered credential')),
  ],
  task: async (c) => {
    await c.send('search the web')
  },
})
