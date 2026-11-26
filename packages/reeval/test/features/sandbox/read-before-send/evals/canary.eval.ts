import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { notes } from './env.ts'

// Must fail: no turn has run, so the agent hasn't written notes.txt yet.
export default defineEval({
  environment: notes,
  graders: [observed('notes.txt', (notes) => notes === 'from the agent\n')],
  task: async (c) => {
    c.observe('notes.txt', await c.readFile('notes.txt'))
  },
})
