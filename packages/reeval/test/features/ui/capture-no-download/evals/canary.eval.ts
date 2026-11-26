import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [observed('missing.txt', (value) => value === 'present')],
  task: async (c) => {
    c.observe('missing.txt', await c.readFile('missing.txt'))
  },
})
