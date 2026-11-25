import { defineEval, expect } from 'reeval'

// Must fail: the same rate of 0.67 is below 0.7.
export default defineEval({
  gate: { passRate: 0.7 },
  cases: ['a', 'b', 'c'],
  task: async (c, key) => {
    expect(key, 'passes its case').not.toBe(await c.readFile('failing.txt'))
  },
})
