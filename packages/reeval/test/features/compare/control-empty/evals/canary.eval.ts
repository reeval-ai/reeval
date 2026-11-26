import { defineEval, expect } from 'reeval'
import { empty } from './env.ts'

// Must fail: the empty environment doesn't get the variant's files.
export default defineEval({
  environment: empty,
  task: async (c) => {
    expect(await c.readFile('from-variant.txt')).toBe('variant-only')
  },
})
