import { defineEval, expect, metric } from 'reeval'

// One case of three fails, so the cell's mean score over its cases is 0.67, which clears 0.6.
export default defineEval({
  target: metric(0.6),
  cases: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
  task: async (c, { key }) => {
    expect(key, 'passes its case').not.toBe(await c.readFile('failing.txt'))
  },
})
