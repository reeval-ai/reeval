import { defineEval, expect } from 'reeval'
import { HOG, small } from './env.ts'

// The kernel kills the hog at docker({ memory }): the attempt is an infra error, not a failed check.
export default defineEval({
  environment: small,
  task: async (c) => {
    await expect(c.exec(HOG)).toSucceed()
  },
})
