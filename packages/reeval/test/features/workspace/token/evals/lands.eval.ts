import { defineEval, expect } from 'reeval'
import { privateRepo } from './env.ts'

// The token fetched the repository on the host; the sandbox has the tree and not the token.
export default defineEval({
  environment: privateRepo,
  task: async (c) => {
    expect(await c.readFile('greet.js')).toContain('Hello')
  },
})
