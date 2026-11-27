import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { python } from './env.ts'

// Must fail: a different sandbox id is not what the environment set.
export default defineEval({
  environment: python,
  graders: [observed('sandbox', (id) => id === 'docker')],
  task: async (c) => {
    c.observe('sandbox', c.trial.cell.sandbox)
  },
})
