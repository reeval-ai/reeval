import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: its failure reaches the stream, and the run's exit 1 is attach's.
export default defineEval({
  graders: [observed('attempt', (n) => n === 2)],
  task: async (c) => {
    c.observe('attempt', c.attempt.n)
  },
})
