import { defineEval } from 'reeval'
import { wrote } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent wrote notes.txt, not other.txt.
  graders: [wrote('other.txt')],
  task: async (c) => {
    await c.send('write notes.txt')
  },
})
