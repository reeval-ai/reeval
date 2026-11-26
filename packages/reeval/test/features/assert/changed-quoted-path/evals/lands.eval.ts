import { defineEval } from 'reeval'
import { inDiff } from 'reeval/graders'
import { notes } from './env.ts'

export default defineEval({
  environment: notes,
  graders: [inDiff('notes/café.txt')],
  task: async (c) => {
    await c.send('write the café note')
  },
})
