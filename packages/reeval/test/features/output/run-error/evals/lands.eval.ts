import { defineEval, expect } from 'reeval'

// A rejection nothing awaits, outside any attempt: the eval passes, and the run fails on it.
void Promise.reject(new Error('stray rejection outside the evals'))

export default defineEval({
  task: async (c) => {
    expect(c.attempt.n, 'first try').toBe(1)
  },
})
