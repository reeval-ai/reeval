import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { ordered } from './env.ts'

// Setup steps run in order, the parent environment's first, each to completion.
export default defineEval({
  environment: ordered,
  graders: [hasFile('order.txt', 'one\ntwo\n')],
  task: async (c) => {
    await c.exec('true')
  },
})
