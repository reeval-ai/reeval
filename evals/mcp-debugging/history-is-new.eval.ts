import { defineEval, defineGrader } from 'reeval'
import {
  answer,
  history,
  leavesHistory,
  named,
  observeHistory,
  study,
  toolkit,
} from './debugging.ts'

const old = ['clamps a number', 'builds the report']

export default defineEval({
  ...study('is-new', toolkit),
  graders: [
    defineGrader('finds-the-new-failure', {
      files: ['answer.json'],
      grade: (c) => answer(c, 'new'),
      score: (given) =>
        named(given, ['title-cases a phrase', ...old]).join() === 'title-cases a phrase' ? 1 : 0,
    }),
    defineGrader('finds-the-old-failures', {
      files: ['answer.json'],
      grade: (c) => answer(c, 'old'),
      score: (given) => (named(given, old).join() === old.join() ? 1 : 0),
    }),
    leavesHistory,
  ],
  task: async (c) => {
    await c.send(`${history}

The latest run failed. Which of its failing evals are failing for the first time in this history, and which failed in earlier runs too? Don't change any files.

Write answer.json: {"new": ["<eval name>", …], "old": ["<eval name>", …]}.`)
    await observeHistory(c)
  },
})
