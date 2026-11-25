import { defineEval, expect } from 'reeval'
import { cases } from './env.ts'

// Must fail: the case's word isn't the file's.
export default defineEval({
  cases: [{ id: 'hello', file: 'word.txt', word: 'hello' }],
  environment: cases,
  task: async (c, { file, word }) => {
    expect(await c.readFile(file)).toBe(word)
  },
})
