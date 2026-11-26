import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { child } from './env.ts'

// Must fail: the parent sandbox is not merged onto the child.
export default defineEval({
  environment: child,
  graders: [observed('sandbox', (id) => id === 'parent')],
  task: async (c) => {
    c.observe('sandbox', c.attempt.cell.sandbox)
  },
})
