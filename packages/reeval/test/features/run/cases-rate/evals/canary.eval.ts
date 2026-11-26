import { defineEval, expect, metric } from 'reeval'

// Must fail: the same mean score of 0.67 is below 0.7.
export default defineEval({
  target: metric(0.7),
  cases: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
  task: async (c, { key }) => {
    expect(key, 'passes its case').not.toBe(await c.readFile('failing.txt'))
  },
})
