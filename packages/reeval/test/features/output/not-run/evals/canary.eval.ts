import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// Must fail: `reached` runs without the marker and fails there, so its cell reads `0 of 1`.
export default defineEval({
  environment: plain,
  task: async (c) => {
    expect(c.attempt.cell.role, 'reached').toBe('variant')
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
