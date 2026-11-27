import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { next, vite } from './env.ts'

// Must fail: the filter goes by the baseline's traits, so the vite-app variant runs with it.
export default defineEval({
  compare: { baseline: next, variants: [vite] },
  trials: 1,
  graders: [observed('stack', (stack) => stack === 'next')],
  task: async (c) => {
    c.observe('stack', await c.readFile('stack.txt'))
  },
})
