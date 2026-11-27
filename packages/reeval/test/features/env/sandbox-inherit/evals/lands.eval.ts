import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain, skilled } from './env.ts'

// The cell's sandbox is the root machine, not the config environment's.
export default defineEval({
  compare: { baseline: plain, variants: [skilled] },
  graders: [observed('sandbox', (id) => id === 'from-root')],
  task: async (c) => {
    c.observe('sandbox', c.trial.cell.sandbox)
  },
})
