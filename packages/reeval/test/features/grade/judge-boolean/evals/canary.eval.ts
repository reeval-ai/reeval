import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { exportsAnswer, says41 } from './graders.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent wrote 42, so the judge says no.
  graders: [exportsAnswer, says41],
  task: async (c) => void (await c.send('set the answer')),
})
