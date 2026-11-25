import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// A study: nothing gates it, so its misses in both arms leave it `ran`, never `pass`.
export default defineEval({
  compare: { control: plain, variants: [marked], gate: 'observe' },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt', /nope/)
  },
})
