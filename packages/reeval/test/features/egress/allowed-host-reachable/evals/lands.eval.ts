import { defineEval, expect } from 'reeval'
import { agentSaw, listed } from './env.ts'

// A host the policy allows is reachable from the sandbox.
export default defineEval({
  environment: listed,
  task: async (c) => {
    const [body] = agentSaw(await c.send('fetch the listener'))
    expect(body?.trim()).toBe('reeval-egress-ok')
  },
})
