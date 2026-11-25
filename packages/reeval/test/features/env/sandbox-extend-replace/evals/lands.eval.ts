import { defineEval, expect } from 'reeval'
import { child } from './env.ts'

// `.extend` replaces the parent's sandbox; the cell uses the child's.
export default defineEval({
  environment: child,
  task: async (c) => {
    expect(c.attempt.cell.sandbox).toBe('child')
  },
})
