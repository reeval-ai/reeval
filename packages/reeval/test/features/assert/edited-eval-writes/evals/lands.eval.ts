import { defineEval, expect } from 'reeval'
import { notes } from './env.ts'

export default defineEval({
  environment: notes,
  task: async (c) => {
    await c.exec('echo changed > notes.txt')
    const turn = await c.send('read notes.txt')
    expect(turn).not.toHaveEdited('notes.txt')
  },
})
