import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    try {
      await c.capture(9, { name: 'x' })
    } catch (error) {
      expect((error as Error).message).toMatch(/skipped/)
    }
  },
})
