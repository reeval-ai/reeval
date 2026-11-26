import { defineEval, expect } from 'reeval'

// One case of three fails, so the cell's rate over its cases is 0.67, which clears 0.6.
export default defineEval({
  gate: { passRate: 0.6 },
  cases: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
  task: async (c, { key }) => {
    expect(key, 'passes its case').not.toBe(await c.readFile('failing.txt'))
  },
})
