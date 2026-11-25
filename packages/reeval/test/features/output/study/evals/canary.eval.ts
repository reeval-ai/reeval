import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// Must fail: the same misses with `gate: 'all'` gate the eval.
export default defineEval({
  compare: { control: plain, variants: [marked], gate: 'all' },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt', /nope/)
  },
})
