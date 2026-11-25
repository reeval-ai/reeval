import { defineEval, expect } from 'reeval'
import { agentSaw, closed } from './env.ts'

// Must fail: under deny-all the same request gets the gateway's refusal.
export default defineEval({
  environment: closed,
  task: async (c) => {
    const [body] = agentSaw(await c.send('fetch the listener'))
    expect(body?.trim()).toBe('reeval-egress-ok')
  },
})
