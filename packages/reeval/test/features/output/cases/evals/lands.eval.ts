import { defineEval, expect } from 'reeval'

// An eval with cases is one row; every case passed, so it prints on one line.
export default defineEval({
  cases: [{ key: 'red' }, { key: 'blue' }],
  task: async (_c, { key: color }) => {
    expect(color.length, 'named').toBeGreaterThan(0)
  },
})
