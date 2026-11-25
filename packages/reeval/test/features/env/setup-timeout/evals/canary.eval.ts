import { defineEval, expect } from 'reeval'
import { quick } from './env.ts'

// Must fail: a step that finishes within its timeout isn't cut off.
export default defineEval({
  environment: quick,
  task: async (c) => {
    expect(await c.readFile('slept')).toBeNull()
  },
})
