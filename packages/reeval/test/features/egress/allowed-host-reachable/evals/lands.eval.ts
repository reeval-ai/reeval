import { defineEval } from 'reeval'
import { agentPrinted, listed } from './env.ts'

// A host the policy allows is reachable from the sandbox.
export default defineEval({
  environment: listed,
  graders: [agentPrinted('reaches-the-listener', ([body]) => body?.trim() === 'reeval-egress-ok')],
  task: async (c) => {
    await c.send('fetch the listener')
  },
})
