import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { patched } from './env.ts'

// Must fail: the repository's own greet.js was replaced.
export default defineEval({
  environment: patched,
  graders: [observed<string>('greet.js', (text) => text.includes('Hello'))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
