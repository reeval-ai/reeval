import { defineEval, expect } from 'reeval'

// Must fail: the one fail the tally counts.
export default defineEval({
  task: async (c) => {
    expect(c.attempt.n, 'second try').toBe(2)
  },
})
