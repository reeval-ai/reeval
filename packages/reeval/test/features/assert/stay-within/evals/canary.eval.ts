import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// Must fail: one token below what the fake turn reports.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send('look around')
    expect(turn).toStayWithin({ tokens: 1199 })
  },
})
