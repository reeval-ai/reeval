import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { built } from './env.ts'

// Must fail: setup saw the v1 tag, not main.
export default defineEval({
  environment: built,
  graders: [observed<string>('seen-by-setup.txt', (text) => text === 'v2\n')],
  task: async (c) => {
    c.observe('seen-by-setup.txt', await c.readFile('seen-by-setup.txt'))
  },
})
