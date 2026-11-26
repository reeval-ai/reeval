import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  capture: { timeout: '2s' },
  environment: plain,
  graders: [observed<string>('error', (message) => message === 'port is closed')],
  task: async (c) => {
    try {
      await c.capture(59999, { name: 'gone' })
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
