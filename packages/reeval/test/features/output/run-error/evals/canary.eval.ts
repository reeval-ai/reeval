import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: the one fail the tally counts beside the run error.
export default defineEval({
  graders: [observed('trial', (n) => n === 2)],
  task: async (c) => {
    c.observe('trial', c.trial.n)
  },
})
