import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { placed, review } from './env.ts'

// Must fail: only leaves the plugin's commands out, so commands/review.md isn't placed.
export default defineEval({
  environment: review,
  graders: [observed<string>('review.md', (text) => text.includes('Review the working tree.'))],
  task: async (c) => {
    c.observe('review.md', (await c.exec(`cat ${placed}/commands/review.md`)).stdout)
  },
})
