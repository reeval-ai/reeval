import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { harsh, tone } from './graders.ts'

export default defineEval({
  environment: plain,
  // The mistake: one model answers poor, so the mean is 0.5.
  graders: [harsh, tone],
  task: async (c) => void (await c.send('set the answer')),
})
