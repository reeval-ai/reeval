import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { next, vite } from './env.ts'

// Run with --trait stack=next: the vite-app cell is left out, so only next-app runs.
export default defineEval({
  environment: [next, vite],
  graders: [observed('stack', (stack) => stack === 'next')],
  task: async (c) => {
    c.observe('stack', await c.readFile('stack.txt'))
  },
})
