import { defineEval, regression } from 'reeval'
import { plain } from './env.ts'
import { half, whole } from './graders.ts'

// Must fail: the same 0.75 is below regression(0.8).
export default defineEval({
  environment: plain,
  target: regression(0.8),
  graders: [half, whole],
  task: async (c) => void (await c.send('build it')),
})
