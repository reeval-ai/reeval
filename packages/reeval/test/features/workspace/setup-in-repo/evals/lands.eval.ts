import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { built } from './env.ts'

// Setup steps run in the workspace after the repository is copied in.
export default defineEval({
  environment: built,
  graders: [observed<string>('seen-by-setup.txt', (text) => text === 'v1\n')],
  task: async (c) => {
    c.observe('seen-by-setup.txt', await c.readFile('seen-by-setup.txt'))
  },
})
