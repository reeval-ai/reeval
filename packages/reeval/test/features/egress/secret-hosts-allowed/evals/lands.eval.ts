import { defineEval, expect } from 'reeval'
import { agentSaw, keyed } from './env.ts'

// Under deny-all a brokered secret's hosts are allowed, so its API stays reachable.
export default defineEval({
  environment: keyed,
  task: async (c) => {
    const [body] = agentSaw(await c.send('fetch the listener'))
    expect(body?.trim()).toBe('reeval-egress-ok')
  },
})
