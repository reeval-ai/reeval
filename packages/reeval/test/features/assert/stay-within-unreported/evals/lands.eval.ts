import { defineEval } from 'reeval'
import { withinLimits } from 'reeval/graders'
import { plain } from './env.ts'

// An error, not a failure: the turn can't show it stayed within its tokens.
export default defineEval({
  environment: plain,
  graders: [withinLimits({ tokens: 10 })],
  task: async (c) => {
    await c.send('look around')
  },
})
