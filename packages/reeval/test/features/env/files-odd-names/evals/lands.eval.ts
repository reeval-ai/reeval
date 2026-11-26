import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { listed, listing, oddNames } from './env.ts'

const want = ['dir/in.txt', 'odd\n./plain.txt', 'plain.txt', 'two\nlines.txt']

// Every file lands, the ones whose names have a line break in them too.
export default defineEval({
  environment: oddNames,
  graders: [listed('every-name', (names) => (isDeepStrictEqual(names, want) ? 1 : 0))],
  task: async (c) => {
    await c.exec(listing)
  },
})
