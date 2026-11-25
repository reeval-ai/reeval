import { defineEval, expect } from 'reeval'

// Must fail: its block names the failed check and its assertion.
export default defineEval({
  task: async (c) => {
    expect(c.attempt.n, 'second try').toBe(2)
  },
})
