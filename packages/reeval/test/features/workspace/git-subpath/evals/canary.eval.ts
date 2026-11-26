import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { app } from './env.ts'

// Must fail: main's newer greeting isn't what the v1 tag holds.
export default defineEval({
  environment: app,
  graders: [observed<string>('greet.js', (text) => text.includes("'Ahoy'"))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
