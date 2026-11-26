import { defineEval, defineGrader } from 'reeval'
import { cases } from './env.ts'

// Must fail: the case's word isn't the file's.
export default defineEval({
  cases: [{ key: 'hello', file: 'word.txt', word: 'hello' }],
  environment: cases,
  graders: [
    defineGrader<{ word: string }>('word', {
      grade: (c) => c.observation('word') === c.case.word,
    }),
  ],
  task: async (c, { file }) => {
    c.observe('word', await c.readFile(file))
  },
})
