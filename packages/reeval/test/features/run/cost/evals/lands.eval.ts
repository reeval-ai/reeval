import { defineEval } from 'reeval'
import { tokens } from 'reeval/graders'
import { listed, reporter, unknown } from './agents.ts'

// A reported cost, an estimate at models.dev's list price, and no cost for an unlisted model.
export default defineEval({
  agents: [reporter, listed, unknown],
  graders: [tokens({ score: (used) => (used === null ? 0 : 1) })],
  task: async (c) => {
    await c.send('say hi')
  },
})
