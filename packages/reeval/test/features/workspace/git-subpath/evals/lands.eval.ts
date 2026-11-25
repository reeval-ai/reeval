import { defineEval, expect } from 'reeval'
import { app } from './env.ts'

// The workspace is app/'s contents at the v1 tag, not at the branch head.
export default defineEval({
  environment: app,
  task: async (c) => {
    expect(await c.readFile('greet.js')).toContain("'Hello'")
  },
})
