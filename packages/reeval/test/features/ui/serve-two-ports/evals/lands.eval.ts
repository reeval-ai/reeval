import { defineEval } from 'reeval'
import { ui } from './env.ts'

// c.serve fails, listing both ports, rather than guess one.
export default defineEval({
  environment: ui,
  task: async (c) => {
    await c.serve('node server.mjs')
  },
})
