import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './env.ts'
import { FLAKY } from './flaky.ts'

// The first try fails; the retry passes, so the stored exit code is 0.
export default defineEval({
  environment: plain,
  graders: [succeeded('flaky passes')],
  task: async (c) => {
    await c.exec(FLAKY, { retries: 2, interval: 0, label: 'flaky passes' })
  },
})
