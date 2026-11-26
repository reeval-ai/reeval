import { defineEval } from 'reeval'
import { ran } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [ran({ program: 'printf', args: /^contract-42$/ })],
  task: async (c) => {
    await c.send('print the contract token')
  },
})
