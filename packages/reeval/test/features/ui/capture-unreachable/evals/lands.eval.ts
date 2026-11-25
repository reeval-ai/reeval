import { defineEval } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  capture: { timeout: '2s' },
  task: async (c) => {
    await c.capture(59999, { name: 'gone' })
  },
})
