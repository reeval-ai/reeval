import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.send('write the marker')
    // The mistake: the marker says ok, not nope.
    await expect(c, 'writes the marker').toHaveFile('marker.txt', /nope/)
  },
})
