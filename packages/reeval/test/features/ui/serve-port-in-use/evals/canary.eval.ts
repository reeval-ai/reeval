import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Must fail: c.serve refuses the port the first server holds, it doesn't serve on it.
export default defineEval({
  environment: ui,
  graders: [observed<string>('error', (message) => message === 'served')],
  task: async (c) => {
    const dev = await c.serve('node server.mjs dev')
    try {
      await c.serve('node server.mjs preview $PORT', dev.port)
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
