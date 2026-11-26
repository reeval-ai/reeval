import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { hiddenTests } from './graders.ts'

export default defineEval({
  environment: plain,
  // The mistake: one of the hidden tests expects the wrong sum.
  graders: [hiddenTests('wrong')],
  task: async (c) => {
    await c.send('write add')
  },
})
