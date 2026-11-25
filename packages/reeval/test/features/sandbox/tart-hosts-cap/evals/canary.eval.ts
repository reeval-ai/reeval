import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// Must fail: preflight skipped small, so no VM runs there.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [where] = agentSaw(await c.send('where am I'))
    expect(where).toMatch(/\/hosts\/small\//)
  },
})
