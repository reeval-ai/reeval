import { defineEval, expect } from 'reeval'
import { patched } from './env.ts'

// Must fail: the repository's own greet.js was replaced.
export default defineEval({
  environment: patched,
  task: async (c) => {
    expect(await c.readFile('greet.js')).toContain('Hello')
  },
})
