import { defineEval } from 'reeval'
import { inDiff } from 'reeval/graders'
import { seeded } from './env.ts'

export default defineEval({
  environment: seeded,
  graders: [inDiff('test/**')],
  task: async (c) => {
    await c.send('update the greet test')
  },
})
