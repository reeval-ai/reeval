import { defineEval, expect } from 'reeval'
import { python } from './env.ts'

// Must fail: a different sandbox id is not what the environment set.
export default defineEval({
  environment: python,
  task: async (c) => {
    expect(c.attempt.cell.sandbox).toBe('docker')
  },
})
