import { defineEval, expect } from 'reeval'

// Must fail: green isn't red, so that case fails the eval, and its case table marks it.
export default defineEval({
  cases: ['red', 'green'],
  task: async (_c, color) => {
    expect(color, 'is red').toBe('red')
  },
})
