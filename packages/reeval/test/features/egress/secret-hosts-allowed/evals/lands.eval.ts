import { defineEval } from 'reeval'
import { agentPrinted, keyed } from './env.ts'

// Under deny-all a brokered secret's hosts are allowed, so its API stays reachable.
export default defineEval({
  environment: keyed,
  graders: [agentPrinted('reaches-the-listener', ([body]) => body?.trim() === 'reeval-egress-ok')],
  task: async (c) => {
    await c.send('fetch the listener')
  },
})
