import { defineEval, expect } from 'reeval'
import { notes } from './env.ts'

export default defineEval({
  environment: notes,
  task: async (c) => {
    await c.send('write the café note')
    // The agent did write notes/café.txt.
    expect(c).not.toHaveChanged('notes/café.txt')
  },
})
