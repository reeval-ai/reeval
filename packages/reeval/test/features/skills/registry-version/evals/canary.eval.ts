import { defineEval, expect } from 'reeval'
import { pinned, staged } from './env.ts'

// Must fail: main's newer greeting isn't what the v1 tag holds.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Hello there, <name>.')
  },
})
