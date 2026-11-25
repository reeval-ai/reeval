import { defineEval, expect } from 'reeval'
import { privateRepo } from './env.ts'

// Must fail: the v1 tag, not main, is what was fetched.
export default defineEval({
  environment: privateRepo,
  task: async (c) => {
    expect(await c.readFile('greet.js')).toContain('Ahoy')
  },
})
