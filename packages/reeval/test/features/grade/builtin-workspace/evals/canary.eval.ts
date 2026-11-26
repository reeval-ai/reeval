import { defineEval } from 'reeval'
import { inDiff, notInDiff } from 'reeval/graders'
import { app } from './env.ts'

export default defineEval({
  environment: app,
  // The mistake: the agent changed src/, which this says it mustn't.
  graders: [inDiff('src/**'), notInDiff('src/**', { required: true })],
  task: async (c) => {
    await c.send('add retry')
  },
})
