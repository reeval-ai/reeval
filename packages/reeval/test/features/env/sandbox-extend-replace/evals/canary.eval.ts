import { defineEval, expect } from 'reeval'
import { child } from './env.ts'

// Must fail: the parent sandbox is not merged onto the child.
export default defineEval({
  environment: child,
  task: async (c) => {
    expect(c.attempt.cell.sandbox).toBe('parent')
  },
})
