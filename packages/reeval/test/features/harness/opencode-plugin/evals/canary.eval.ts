import { defineEval, expect } from 'reeval'
import { house, trimmed } from './env.ts'

// Must fail: the review code is written by the agent following the unpacked subagent, not by
// reeval.
export default defineEval({
  environment: house,
  task: async (c) => {
    expect(await trimmed(c.readFile, 'review.txt')).toBe('HERON-62')
  },
})
