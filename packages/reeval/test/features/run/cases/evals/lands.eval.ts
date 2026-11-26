import { defineEval, defineGrader } from 'reeval'
import { cases } from './env.ts'

export default defineEval({
  cases: [{ key: 'ahoy', file: 'word.txt', word: 'ahoy' }],
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
