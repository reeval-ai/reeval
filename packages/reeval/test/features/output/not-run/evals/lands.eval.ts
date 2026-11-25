import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// The control has no marker, so its failed `expect.require` ends the body: `reached` doesn't run
// there, and its cell reads `not run`, never `0 of 1`.
export default defineEval({
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect.require(c, 'has the marker').toHaveFile('marker.txt')
    expect(c.attempt.cell.role, 'reached').toBe('variant')
  },
})
