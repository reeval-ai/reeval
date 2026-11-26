import { defineEval, expect, metric } from 'reeval'
import { marked, plain } from './env.ts'

// A study: metric() gates nothing, so its misses in both arms leave it `ran`, never `pass`.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  target: metric(),
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt', /nope/)
  },
})
