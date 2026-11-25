import { defineEval, expect } from 'reeval'
import { tokens } from './env.ts'

// Must fail: the checks aren't kept from the secret the way the agent is.
export default defineEval({
  environment: tokens,
  task: async (c) => {
    const seen = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    expect(seen).toBe('')
  },
})
