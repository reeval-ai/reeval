import { defineEval, expect } from 'reeval'

// Must fail: every attempt requires the wrong word, so the first two agree and the third never runs.
export default defineEval({
  runs: { bestOf: 3 },
  task: async (c) => {
    expect.require(await c.readFile('word.txt')).toBe('hello')
  },
})
