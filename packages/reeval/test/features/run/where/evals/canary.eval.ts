import { defineEval, defineGrader } from 'reeval'
import { next, vite } from './env.ts'

// Must fail: this where keeps vite on next-app, a pair lands leaves out.
export default defineEval({
  environment: [next, vite],
  cases: [{ key: 'next' }, { key: 'vite' }],
  where: ({ case: { key: stack }, environment }) =>
    environment.traits.stack === stack || stack === 'vite',
  graders: [
    defineGrader('runs-on-its-own-stack', {
      grade: (c) => c.observation('stack') === c.case.key,
    }),
  ],
  task: async (c) => {
    c.observe('stack', await c.readFile('stack.txt'))
  },
})
