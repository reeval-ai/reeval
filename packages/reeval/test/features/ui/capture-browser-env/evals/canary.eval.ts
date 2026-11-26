import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [observed<string>('error', (message) => /skipped/.test(message))],
  task: async (c) => {
    try {
      await c.capture(9, { name: 'x' })
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
