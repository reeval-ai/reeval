import { defineEval, expect } from 'reeval'
import { notes } from './env.ts'

// Must fail: no turn has run, so the agent hasn't written notes.txt yet.
export default defineEval({
  environment: notes,
  task: async (c) => {
    expect(await c.readFile('notes.txt')).toBe('from the agent\n')
  },
})
