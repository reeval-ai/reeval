import { defineEval, expect } from 'reeval'
import { marked, plain } from './env.ts'

// Must fail: `reached` runs in the gated control and fails there, so its cell reads `0 of 1`.
export default defineEval({
  compare: { control: plain, variants: [marked], gate: 'all' },
  task: async (c) => {
    expect(c.attempt.cell.role, 'reached').toBe('variant')
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
