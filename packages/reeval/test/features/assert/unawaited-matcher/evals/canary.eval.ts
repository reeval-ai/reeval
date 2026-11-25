import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.send('write the marker')
    // The mistake: no `await`, so the attempt fails naming the matcher and this line.
    expect(c, 'writes the marker').toHaveFile('marker.txt', /ok/)
  },
})
