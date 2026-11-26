import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { python } from './env.ts'

// The cell's sandbox id is the environment's, not an implicit default.
export default defineEval({
  environment: python,
  graders: [observed('sandbox', (id) => id === 'python')],
  task: async (c) => {
    c.observe('sandbox', c.attempt.cell.sandbox)
  },
})
