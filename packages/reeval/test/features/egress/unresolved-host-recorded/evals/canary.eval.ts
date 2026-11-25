import { defineEval, expect } from 'reeval'
import { agentSaw, proxied } from './env.ts'

// Must fail: no policy refused the name, so the body doesn't say it did.
export default defineEval({
  environment: proxied,
  task: async (c) => {
    const [body] = agentSaw(await c.send('fetch a host that does not exist'))
    expect(body).toContain('blocked by the reeval egress policy')
  },
})
