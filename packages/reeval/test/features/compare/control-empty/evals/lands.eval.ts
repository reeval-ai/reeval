import { defineEval, expect } from 'reeval'
import { empty, variant } from './env.ts'

// An empty control runs without the variant's files.
export default defineEval({
  compare: { control: empty, variants: [variant], gate: 'all' },
  task: async (c) => {
    if (c.attempt.cell.role !== 'control') return
    expect(await c.readFile('from-variant.txt')).toBe(null)
  },
})
