import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// An error, not a failure: the turn can't show it stayed within its tokens.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send('look around')
    expect(turn).toStayWithin({ tokens: 10 })
  },
})
