import { defineEval, expect } from 'reeval'
import { plain, skilled } from './env.ts'

// Must fail: the config environment's sandbox is not inherited.
export default defineEval({
  compare: { control: plain, variants: [skilled] },
  task: async (c) => {
    expect(c.attempt.cell.sandbox).toBe('from-config-env')
  },
})
