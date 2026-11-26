import { defineEval } from 'reeval'
import { notInDiff } from 'reeval/graders'
import { seeded } from './env.ts'

export default defineEval({
  environment: seeded,
  // The agent's shell command did change the test.
  graders: [notInDiff('test/**')],
  task: async (c) => {
    await c.send('update the greet test')
  },
})
