import { defineEval } from 'reeval'
import { ui } from './env.ts'

// c.serve refuses a port a server left running already listens on, rather than check that one.
export default defineEval({
  environment: ui,
  task: async (c) => {
    const dev = await c.serve('node server.mjs dev')
    await c.serve('node server.mjs preview $PORT', dev.port)
  },
})
