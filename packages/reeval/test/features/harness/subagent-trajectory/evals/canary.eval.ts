import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

// The agent's own tokens: the turn's total counts its subagents' too.
const ownTokens = defineGrader('own-tokens', {
  grade: (c) => ({
    input: c.turns[0]?.usage?.input ?? null,
    output: c.turns[0]?.usage?.output ?? null,
  }),
  score: (g) => (g.input === 100 && g.output === 10 ? 1 : 0),
})

export default defineEval({
  environment: plain,
  graders: [ownTokens],
  task: async (c) => {
    await c.send('write add.js and mul.js with two subagents')
  },
})
