import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// The control has no marker and fails; the eval passes on the variant's lift.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await c.send('look for the marker')
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
