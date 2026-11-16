import { evaluate, expect } from 'reeval'
import { listing, oddNames } from './env.ts'

// Must fail: the name keeps its line break, so it isn't split in two.
evaluate('canary', { environments: oddNames }, async (c) => {
  expect(JSON.parse((await c.exec(listing)).stdout)).toContain('lines.txt')
})
