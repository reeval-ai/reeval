import { defineEval } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.capture(9, { name: 'x' })
  },
})
