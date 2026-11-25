import { defineEval, expect } from 'reeval'
import { archived } from './env.ts'

export default defineEval({
  environment: archived,
  task: async (c) => {
    await c.send('look for the marker')
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
