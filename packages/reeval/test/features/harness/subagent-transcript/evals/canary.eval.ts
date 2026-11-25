import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send('write add.js and mul.js with two subagents')
    // The agent's own tokens: the turn's total counts its subagents' too.
    expect(turn.usage).toMatchObject({ input: 100, output: 10 })
  },
})
