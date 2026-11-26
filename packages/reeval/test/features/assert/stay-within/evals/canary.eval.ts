import { defineEval } from 'reeval'
import { withinLimits } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: one token below what the fake turn reports.
  graders: [withinLimits({ tokens: 1199 })],
  task: async (c) => {
    await c.send('look around')
  },
})
