import { defineEval } from 'reeval'
import { tokens } from 'reeval/graders'
import { silent } from './agents.ts'

// Must fail: an agent that reports no tokens has nothing to price.
export default defineEval({
  agents: [silent],
  graders: [tokens({ score: (used) => (used === null ? 0 : 1) })],
  task: async (c) => {
    await c.send('say hi')
  },
})
