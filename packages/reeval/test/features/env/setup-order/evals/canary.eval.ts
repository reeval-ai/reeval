import { defineEval, expect } from 'reeval'
import { ordered } from './env.ts'

// Must fail: the extending environment's step doesn't run first.
export default defineEval({
  environment: ordered,
  task: async (c) => {
    expect(await c.readFile('order.txt')).toBe('two\none\n')
  },
})
