import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { FLAKY } from './flaky.ts'

// The first try fails; the retry passes, so the check does.
export default defineEval({
  environment: plain,
  task: async (c) => {
    await expect(c.exec(FLAKY, { retries: 2, interval: 0 }), 'flaky passes').toSucceed()
  },
})
