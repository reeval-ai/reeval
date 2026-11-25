import { defineEval, expect } from 'reeval'

// One cell that passes prints its verdict and name, nothing under it.
export default defineEval({
  task: async (c) => {
    expect(c.attempt.n, 'first try').toBe(1)
  },
})
