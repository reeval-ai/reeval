import { defineEval, expect } from 'reeval'
import { next, vite } from './env.ts'

// Must fail: this where keeps vite on next-app, a pair lands leaves out.
export default defineEval({
  environment: [next, vite],
  cases: [{ key: 'next' }, { key: 'vite' }],
  where: ({ case: { key: stack }, environment }) => environment.traits.stack === stack || stack === 'vite',
  task: async (c, { key: stack }) => {
    expect(await c.readFile('stack.txt'), 'runs on its own stack').toBe(stack)
  },
})
