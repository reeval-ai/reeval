import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// Measure a change: a row per arm, `N of M` and the effect, then the checks that failed in some arm.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
