import { defineEval, defineGraders } from 'reeval'
import {
  answer,
  history,
  leavesHistory,
  named,
  observeHistory,
  study,
  toolkit,
} from './debugging.ts'

const regressed = ['pads a string', 'removes duplicates']

export default defineEval({
  ...study('regression', toolkit),
  graders: [
    defineGraders(['finds-each-regression', 'names-nothing-else'], {
      files: ['answer.json'],
      grade: (c) => answer(c, 'regressed'),
      score: {
        'finds-each-regression': (given) =>
          named(given, regressed).join() === regressed.join() ? 1 : 0,
        'names-nothing-else': (given) =>
          named(given, ['clamps a number', 'chunks an array', 'sums a list']).length ? 0 : 1,
      },
    }),
    leavesHistory,
  ],
  task: async (c) => {
    await c.send(`${history}

Compare the run recorded at the tag v1.2 with the latest run. Which evals regressed: passed at v1.2 and fail in the latest run? Don't change any files.

Write answer.json: {"regressed": ["<eval name>", …]}.`)
    await observeHistory(c)
  },
})
