import { defineEval, expect } from 'reeval'

// Must fail: the one fail the tally counts beside the run error.
export default defineEval({
  task: async (c) => {
    expect(c.attempt.n, 'second try').toBe(2)
  },
})
