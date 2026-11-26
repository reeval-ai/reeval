import { capability, defineEval, expect } from 'reeval'

// Must fail: no attempt passes, and the target blocks.
export default defineEval({
  target: capability(1, { blocking: true }),
  task: async (c) => {
    expect(c.attempt.n, 'lands on the third try').toBe(3)
  },
})
