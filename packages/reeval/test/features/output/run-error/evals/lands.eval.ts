import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// A rejection nothing awaits, outside any attempt: the eval passes, and the run fails on it.
void Promise.reject(new Error('stray rejection outside the evals'))

export default defineEval({
  graders: [observed('attempt', (n) => n === 1)],
  task: async (c) => {
    c.observe('attempt', c.attempt.n)
  },
})
