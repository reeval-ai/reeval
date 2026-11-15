import { evaluate, expect } from 'reeval'
import { listing, oddNames } from './env.ts'

// Every file lands, the one whose name has a line break in it too.
evaluate('lands', { environments: oddNames }, async (c) => {
  expect(JSON.parse((await c.exec(listing)).stdout)).toEqual([
    'dir/in.txt',
    'plain.txt',
    'two\nlines.txt',
  ])
})
