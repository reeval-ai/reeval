import { defineEval } from 'reeval'
import { notInDiff } from 'reeval/graders'
import { notes } from './env.ts'

export default defineEval({
  environment: notes,
  // The agent did write notes/café.txt.
  graders: [notInDiff('notes/café.txt')],
  task: async (c) => {
    await c.send('write the café note')
  },
})
