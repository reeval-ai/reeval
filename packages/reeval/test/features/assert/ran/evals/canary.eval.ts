import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send('echo the contract token')
    expect(turn).toHaveRun(/deploy/)
  },
})
