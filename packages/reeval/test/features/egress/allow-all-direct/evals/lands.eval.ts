import { defineEval } from 'reeval'
import { agentPrinted, open } from './env.ts'

// Under allow-all the container keeps its network: a raw TCP connection goes out directly, around
// the gateway, and reaches the listener.
export default defineEval({
  environment: open,
  graders: [agentPrinted('reaches-directly', ([raw]) => raw?.trim() === 'reeval-egress-ok exit=0')],
  task: async (c) => {
    await c.send('connect over raw TCP')
  },
})
