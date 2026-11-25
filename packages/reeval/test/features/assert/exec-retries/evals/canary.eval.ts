import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { FLAKY } from './flaky.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    // The mistake: no retries, so the transient first try is the check's answer.
    await expect(c.exec(FLAKY), 'flaky passes').toSucceed()
  },
})
