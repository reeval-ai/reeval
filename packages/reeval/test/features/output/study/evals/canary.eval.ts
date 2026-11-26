import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// Must fail: the same misses under the config's regression() gate the variant.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt', /nope/)
  },
})
