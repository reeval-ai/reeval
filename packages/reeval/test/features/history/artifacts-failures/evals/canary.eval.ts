import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// The mistake: the baseline and the variant are swapped, so the variant has no marker.
export default defineEval({
  compare: { control: marked, variants: [plain] },
  task: async (c) => {
    await c.send('look for the marker')
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
