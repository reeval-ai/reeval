import { defineEval, expect } from 'reeval'

// The second attempt expects another word, so the first two split and a third breaks the tie.
export default defineEval({
  runs: { bestOf: 3 },
  task: async (c) => {
    expect(await c.readFile('word.txt')).toBe(c.attempt.n === 2 ? 'hello' : 'ahoy')
  },
})
