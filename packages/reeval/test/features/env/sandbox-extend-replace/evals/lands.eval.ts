import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { child } from './env.ts'

// `.extend` replaces the parent's sandbox; the cell uses the child's.
export default defineEval({
  environment: child,
  graders: [observed('sandbox', (id) => id === 'child')],
  task: async (c) => {
    c.observe('sandbox', c.attempt.cell.sandbox)
  },
})
