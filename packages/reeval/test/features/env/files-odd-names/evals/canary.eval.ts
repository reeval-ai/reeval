import { defineEval } from 'reeval'
import { listed, listing, oddNames } from './env.ts'

// Must fail: the name keeps its line break, so it isn't split in two.
export default defineEval({
  environment: oddNames,
  graders: [listed('split-name', (names) => (names.includes('lines.txt') ? 1 : 0))],
  task: async (c) => {
    await c.exec(listing)
  },
})
