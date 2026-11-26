import { capability, defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// The first attempt fails and the second passes: one is enough for pass@k.
export default defineEval({
  target: capability(1, { blocking: true }),
  graders: [observed('attempt', (n) => n === 2)],
  task: async (c) => {
    c.observe('attempt', c.attempt.n)
  },
})
