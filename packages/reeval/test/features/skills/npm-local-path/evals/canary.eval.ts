import { defineEval, expect } from 'reeval'
import { staged, vendored } from './env.ts'

// Must fail: the other vendored tarball's greeting isn't what 1.2.3 holds.
export default defineEval({
  environment: vendored,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Hello there, <name>.')
  },
})
