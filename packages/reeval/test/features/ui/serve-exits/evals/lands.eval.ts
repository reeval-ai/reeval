import { defineEval } from 'reeval'
import { ui } from './env.ts'

// c.serve fails as soon as the command exits, with its last output.
export default defineEval({
  environment: ui,
  task: async (c) => {
    await c.serve('node server.mjs')
  },
})
