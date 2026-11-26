import { defineEval } from 'reeval'
import { agentPrinted, closed } from './env.ts'

// Must fail: without the secret, deny-all refuses its host.
export default defineEval({
  environment: closed,
  graders: [agentPrinted('reaches-the-listener', ([body]) => body?.trim() === 'reeval-egress-ok')],
  task: async (c) => {
    await c.send('fetch the listener')
  },
})
