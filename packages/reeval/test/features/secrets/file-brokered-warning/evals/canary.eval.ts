import { defineEval, expect } from 'reeval'
import { agentSaw, keys } from './env.ts'

// Must fail: the agent holds the placeholder, not the value.
export default defineEval({
  environment: keys,
  task: async (c) => {
    const [key] = agentSaw(await c.send('send the keys'))
    expect(key).toBe('[REDACTED]')
  },
})
