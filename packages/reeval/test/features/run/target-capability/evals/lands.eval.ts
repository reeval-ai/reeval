import { capability, defineEval, expect } from 'reeval'

// The first attempt fails and the second passes: one is enough for pass@k.
export default defineEval({
  target: capability(1, { blocking: true }),
  task: async (c) => {
    expect(c.attempt.n, 'lands on the second try').toBe(2)
  },
})
