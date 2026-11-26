import { defineEval } from 'reeval'
import { withinLimits } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the limits it can check still fail, here a tool count below the turn's.
  graders: [withinLimits({ toolCalls: 0, duration: '5m' })],
  task: async (c) => {
    await c.send('look around')
  },
})
