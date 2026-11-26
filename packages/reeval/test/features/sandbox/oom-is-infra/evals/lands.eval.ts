import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { HOG, small } from './env.ts'

// The kernel kills the hog at docker({ memory }): the attempt is an infra error, not a failed check.
export default defineEval({
  environment: small,
  graders: [succeeded('hog')],
  task: async (c) => {
    await c.exec(HOG, { label: 'hog' })
  },
})
