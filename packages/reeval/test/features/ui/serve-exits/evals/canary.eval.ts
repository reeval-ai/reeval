import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Must fail: a command that exits never serves.
export default defineEval({
  environment: ui,
  graders: [observed<string>('error', (message) => message === 'served')],
  task: async (c) => {
    try {
      await c.serve('node server.mjs')
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
