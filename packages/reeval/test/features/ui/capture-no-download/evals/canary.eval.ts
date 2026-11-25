import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    expect(await c.readFile('missing.txt')).toBe('present')
  },
})
