import { defineEval } from 'reeval'
import { ran } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent never ran deploy.
  graders: [ran(/deploy/)],
  task: async (c) => {
    await c.send('echo the contract token')
  },
})
