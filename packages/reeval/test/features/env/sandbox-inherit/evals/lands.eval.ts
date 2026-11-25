import { defineEval, expect } from 'reeval'
import { plain, skilled } from './env.ts'

// The cell's sandbox is the root machine, not the config environment's.
export default defineEval({
  compare: { control: plain, variants: [skilled] },
  task: async (c) => {
    expect(c.attempt.cell.sandbox).toBe('from-root')
  },
})
