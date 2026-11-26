import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain, skilled } from './env.ts'

// Must fail: the config environment's sandbox is not inherited.
export default defineEval({
  compare: { control: plain, variants: [skilled] },
  graders: [observed('sandbox', (id) => id === 'from-config-env')],
  task: async (c) => {
    c.observe('sandbox', c.attempt.cell.sandbox)
  },
})
