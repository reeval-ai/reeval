import { capability, defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: no trial passes, and the target blocks.
export default defineEval({
  target: capability(1, { blocking: true }),
  graders: [observed('trial', (n) => n === 3)],
  task: async (c) => {
    c.observe('trial', c.trial.n)
  },
})
