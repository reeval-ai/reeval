import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { app } from './env.ts'

// The workspace is app/'s contents at the v1 tag, not at the branch head.
export default defineEval({
  environment: app,
  graders: [observed<string>('greet.js', (text) => text.includes("'Hello'"))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
