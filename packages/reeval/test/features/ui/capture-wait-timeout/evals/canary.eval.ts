import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  capture: { timeout: '5s' },
  environment: ui,
  graders: [observed<string>('error', (message) => message === 'still loading')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    try {
      await c.capture(server, { name: 'busy', wait: 'idle' })
    } catch (error) {
      c.observe('error', (error as Error).message)
    }
  },
})
