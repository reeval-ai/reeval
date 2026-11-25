import { defineEval, expect } from 'reeval'
import { baseline, variant } from './env.ts'

// Must fail: compare does not layer the baseline into the variant.
export default defineEval({
  compare: { control: baseline, variants: [variant] },
  task: async (c) => {
    if (c.attempt.cell.role !== 'variant') return
    expect(await c.readFile('from-baseline.txt')).toBe('baseline-only')
  },
})
