import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// The agent holds a placeholder for its harness's key, and goes out through the gateway.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [key, proxy] = agentSaw(await c.send('which key do I have'))
    expect(key).toMatch(/^reeval_fake_/)
    expect(proxy).toBe('http://127.0.0.1:24128')
  },
})
