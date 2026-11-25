import { defineEval, expect } from 'reeval'
import { listing, oddNames } from './env.ts'

// Every file lands, the ones whose names have a line break in them too.
export default defineEval({
  environment: oddNames,
  task: async (c) => {
    expect(JSON.parse((await c.exec(listing)).stdout)).toEqual([
      'dir/in.txt',
      'odd\n./plain.txt',
      'plain.txt',
      'two\nlines.txt',
    ])
  },
})
