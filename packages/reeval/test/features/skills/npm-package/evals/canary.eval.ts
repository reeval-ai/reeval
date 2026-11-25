import { defineEval, expect } from 'reeval'
import { pinned, staged } from './env.ts'

// Must fail: the latest version's greeting isn't what 1.2.3 holds.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Hello there, <name>.')
  },
})
