import { defineEval, expect } from 'reeval'
import { agentSaw, proxied } from './env.ts'

// A name that doesn't resolve gets the lookup's error, not a policy refusal.
export default defineEval({
  environment: proxied,
  task: async (c) => {
    const [body] = agentSaw(await c.send('fetch a host that does not exist'))
    expect(body?.trim()).toMatch(/^reeval egress gateway can't resolve reeval-missing\.invalid: /)
  },
})
