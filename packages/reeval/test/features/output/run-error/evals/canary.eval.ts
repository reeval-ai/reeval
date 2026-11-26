import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: the one fail the tally counts beside the run error.
export default defineEval({
  graders: [observed('attempt', (n) => n === 2)],
  task: async (c) => {
    c.observe('attempt', c.attempt.n)
  },
})
