import { defineEval } from 'reeval'
import { wrote } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [wrote('notes.txt')],
  task: async (c) => {
    await c.send('write notes.txt')
  },
})
