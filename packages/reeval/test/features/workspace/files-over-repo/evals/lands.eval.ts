import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { patched } from './env.ts'

// files are written after the repository is copied in, so they win.
export default defineEval({
  environment: patched,
  graders: [observed<string>('greet.js', (text) => text.includes('Howdy'))],
  task: async (c) => {
    c.observe('greet.js', await c.readFile('greet.js'))
  },
})
