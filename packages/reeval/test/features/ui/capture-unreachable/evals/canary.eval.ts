import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  capture: { timeout: '2s' },
  task: async (c) => {
    try {
      await c.capture(59999, { name: 'gone' })
    } catch (error) {
      expect((error as Error).message).toBe('port is closed')
    }
  },
})
