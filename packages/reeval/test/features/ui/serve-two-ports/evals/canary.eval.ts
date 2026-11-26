import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Must fail: c.serve refuses two ports, it doesn't pick one.
export default defineEval({
  environment: ui,
  graders: [observed<string>('error', (message) => message === 'picked one')],
  task: async (c) => {
    try {
      await c.serve('node server.mjs')
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
