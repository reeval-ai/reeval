import { defineEval } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  capture: { timeout: '60s' },
  task: async (c) => {
    await c.exec('true')
  },
})
