import { defineEval } from 'reeval'
import { agentPrinted, loud } from './env.ts'

// Must fail: Node 22 warns that EnvHttpProxyAgent is experimental.
export default defineEval({
  environment: loud,
  graders: [
    agentPrinted('prints-only-the-body', ([output]) => output?.trim() === 'reeval-egress-ok'),
  ],
  task: async (c) => {
    await c.send('fetch the listener with node')
  },
})
