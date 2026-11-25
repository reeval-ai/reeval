import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// Must fail: the marker says ok, not nope, so the variant fails too.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt', /nope/)
  },
})
