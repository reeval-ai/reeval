import { defineEval, expect } from 'reeval'
import { cases } from './env.ts'

export default defineEval({
  cases: [{ id: 'ahoy', file: 'word.txt', word: 'ahoy' }],
  environment: cases,
  task: async (c, { file, word }) => {
    expect(await c.readFile(file)).toBe(word)
  },
})
