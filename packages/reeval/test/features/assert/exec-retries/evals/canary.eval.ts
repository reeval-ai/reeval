import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './env.ts'
import { FLAKY } from './flaky.ts'

export default defineEval({
  environment: plain,
  graders: [succeeded('flaky passes')],
  task: async (c) => {
    // The mistake: no retries, so the transient first try is the stored result.
    await c.exec(FLAKY, { label: 'flaky passes' })
  },
})
