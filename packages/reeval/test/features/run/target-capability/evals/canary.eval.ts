import { capability, defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: no attempt passes, and the target blocks.
export default defineEval({
  target: capability(1, { blocking: true }),
  graders: [observed('attempt', (n) => n === 3)],
  task: async (c) => {
    c.observe('attempt', c.attempt.n)
  },
})
