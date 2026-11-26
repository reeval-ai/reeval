import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned } from './env.ts'

// Must fail: a ref the repository has is fetched, and v1's greeting isn't main's.
export default defineEval({
  environment: pinned,
  graders: [observed<string>('greet.js', (text) => text.includes('Ahoy'))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
