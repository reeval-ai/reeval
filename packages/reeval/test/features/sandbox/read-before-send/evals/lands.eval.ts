import { defineEval, expect } from 'reeval'
import { notes } from './env.ts'

// The first c.readFile starts the sandbox and session, with no turn sent.
export default defineEval({
  environment: notes,
  task: async (c) => {
    expect(await c.readFile('notes.txt')).toBe('from the environment\n')
  },
})
