import { defineEval } from 'reeval'
import { agentPrinted, quiet } from './env.ts'

// Node's fetch reaches the host through the gateway's proxy, and Node prints nothing else.
export default defineEval({
  environment: quiet,
  graders: [
    agentPrinted('prints-only-the-body', ([output]) => output?.trim() === 'reeval-egress-ok'),
  ],
  task: async (c) => {
    await c.send('fetch the listener with node')
  },
})
