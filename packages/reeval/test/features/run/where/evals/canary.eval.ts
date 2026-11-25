import { defineEval, expect } from 'reeval'
import { next, vite } from './env.ts'

// Must fail: this where keeps vite on next-app, a pair lands leaves out.
export default defineEval({
  environment: [next, vite],
  cases: ['next', 'vite'],
  where: ({ case: stack, environment }) => environment.traits.stack === stack || stack === 'vite',
  task: async (c, stack) => {
    expect(await c.readFile('stack.txt'), 'runs on its own stack').toBe(stack)
  },
})
