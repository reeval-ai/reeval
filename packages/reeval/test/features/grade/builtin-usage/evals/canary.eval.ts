import { defineEval } from 'reeval'
import { withinLimits } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: two turns of 1,200 tokens each are over 2,000.
  graders: [withinLimits({ tokens: 2000 }, { required: true })],
  task: async (c) => {
    await c.send('look around')
    await c.send('and again')
  },
})
