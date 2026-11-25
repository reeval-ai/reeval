import { defineEval, expect } from 'reeval'
import { resume } from './env.ts'

// Must fail: the leftover staging is the same run, not a new one with a different marker.
export default defineEval({
  environment: resume,
  task: async (c) => {
    expect(await c.readFile('marker.txt')).toBe('new-run')
  },
})
