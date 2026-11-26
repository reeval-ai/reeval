import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { notes } from './env.ts'

// The first c.readFile starts the sandbox and session, with no turn sent.
export default defineEval({
  environment: notes,
  graders: [observed('notes.txt', (notes) => notes === 'from the environment\n')],
  task: async (c) => {
    c.observe('notes.txt', await c.readFile('notes.txt'))
  },
})
