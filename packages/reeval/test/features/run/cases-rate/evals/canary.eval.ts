import { defineEval, defineGrader, metric } from 'reeval'

// Must fail: the same mean score of 0.67 is below 0.7.
export default defineEval({
  target: metric(0.7),
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
