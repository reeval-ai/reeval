import { defineEval, expect } from 'reeval'

// An eval with cases is one row; every case passed, so it prints on one line.
export default defineEval({
  cases: ['red', 'blue'],
  task: async (_c, color) => {
    expect(color.length, 'named').toBeGreaterThan(0)
  },
})
