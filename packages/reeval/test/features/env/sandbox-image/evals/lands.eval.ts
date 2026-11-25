import { defineEval, expect } from 'reeval'
import { python } from './env.ts'

// The cell's sandbox id is the environment's, not an implicit default.
export default defineEval({
  environment: python,
  task: async (c) => {
    expect(c.attempt.cell.sandbox).toBe('python')
  },
})
