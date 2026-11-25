import { defineEval, expect } from 'reeval'
import { house, trimmed } from './env.ts'

// Must fail: the codeword is written by the agent following the unpacked rule, not by reeval.
export default defineEval({
  environment: house,
  task: async (c) => {
    expect(await trimmed(c.readFile, 'codeword.txt')).toBe('SAFFRON-73')
  },
})
