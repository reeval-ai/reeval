import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { privateRepo } from './env.ts'

// Must fail: the v1 tag, not main, is what was fetched.
export default defineEval({
  environment: privateRepo,
  graders: [observed<string>('greet.js', (text) => text.includes('Ahoy'))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
