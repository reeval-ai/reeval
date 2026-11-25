import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// The control has no marker, so its failed `expect.require` ends the body: `reached` is not run there, so
// it has no verdict rather than counting as the control's failure.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect.require(c, 'has the marker').toHaveFile('marker.txt')
    expect(c.attempt.cell.role, 'reached').toBe('variant')
  },
})
