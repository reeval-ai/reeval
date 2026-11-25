import { defineEval } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  capture: { timeout: '5s' },
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'busy', wait: 'idle' })
  },
})
