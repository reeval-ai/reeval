import { defineEval, expect } from 'reeval'
import { next, vite } from './env.ts'

// Each case runs only on the environment whose stack it names, so astro runs nowhere.
export default defineEval({
  environment: [next, vite],
  cases: [{ key: 'next' }, { key: 'vite' }, { key: 'astro' }],
  where: ({ case: { key: stack }, environment }) => environment.traits.stack === stack,
  task: async (c, { key: stack }) => {
    expect(await c.readFile('stack.txt'), 'runs on its own stack').toBe(stack)
  },
})
