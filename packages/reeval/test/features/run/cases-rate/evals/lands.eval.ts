import { defineEval, defineGrader, metric } from 'reeval'

// One case of three fails, so the cell's mean score over its cases is 0.67, which clears 0.6.
export default defineEval({
  target: metric(0.6),
  cases: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
  graders: [
    defineGrader('passes-its-case', {
      grade: (c) => c.case.key !== c.observation('failing'),
    }),
  ],
  task: async (c) => {
    c.observe('failing', await c.readFile('failing.txt'))
  },
})
