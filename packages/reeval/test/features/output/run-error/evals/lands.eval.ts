import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// A rejection nothing awaits, outside any trial: the eval passes, and the run fails on it.
void Promise.reject(new Error('stray rejection outside the evals'))

export default defineEval({
  graders: [observed('trial', (n) => n === 1)],
  task: async (c) => {
    c.observe('trial', c.trial.n)
  },
})
