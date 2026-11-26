import { defineEval } from 'reeval'
import { agentPrinted, proxied } from './env.ts'

// Must fail: under the default, 'proxy', the container has no network for the connection to use.
export default defineEval({
  environment: proxied,
  graders: [agentPrinted('reaches-directly', ([raw]) => raw?.trim() === 'reeval-egress-ok exit=0')],
  task: async (c) => {
    await c.send('connect over raw TCP')
  },
})
