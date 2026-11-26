import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { privateRepo } from './env.ts'

// The token fetched the repository on the host; the sandbox has the tree and not the token.
export default defineEval({
  environment: privateRepo,
  graders: [observed<string>('greet.js', (text) => text.includes('Hello'))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
