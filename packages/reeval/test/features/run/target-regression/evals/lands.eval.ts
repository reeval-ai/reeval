import { defineEval, regression } from 'reeval'
import { plain } from './env.ts'
import { half, whole } from './graders.ts'

// The trial scores 0.75, which clears regression(0.7).
export default defineEval({
  environment: plain,
  target: regression(0.7),
  graders: [half, whole],
  task: async (c) => void (await c.send('build it')),
})
