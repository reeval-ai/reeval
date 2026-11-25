import { defineEval, expect } from 'reeval'

// Must fail: its failure reaches the stream, and the run's exit 1 is attach's.
export default defineEval({
  task: async (c) => {
    expect(c.attempt.n, 'second try').toBe(2)
  },
})
