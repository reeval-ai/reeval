import { capability, defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// The first trial fails and the second passes: one is enough for pass@k.
export default defineEval({
  target: capability(1, { blocking: true }),
  graders: [observed('trial', (n) => n === 2)],
  task: async (c) => {
    c.observe('trial', c.trial.n)
  },
})
