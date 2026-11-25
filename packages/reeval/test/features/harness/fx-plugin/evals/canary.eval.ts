import { defineEval, expect } from 'reeval'
import { house, trimmed } from './env.ts'

// Must fail: the style code is written by the agent following the placed skill, not by reeval.
export default defineEval({
  environment: house,
  task: async (c) => {
    expect(await trimmed(c.readFile, 'style.txt')).toBe('PLOVER-27')
  },
})
