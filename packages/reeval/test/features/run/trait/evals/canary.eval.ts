import { defineEval, expect } from 'reeval'
import { next, vite } from './env.ts'

// Must fail: the filter goes by the control's traits, so the vite-app variant runs with it.
export default defineEval({
  compare: { control: next, variants: [vite] },
  runs: 1,
  task: async (c) => {
    expect(await c.readFile('stack.txt'), 'runs on next').toBe('next')
  },
})
