import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { house } from './env.ts'

// Must fail: the review code is written by the agent following the unpacked subagent, not by
// reeval.
export default defineEval({
  environment: house,
  graders: [hasFile('review.txt', /^HERON-62\s*$/)],
  task: async (c) => {
    await c.exec('true')
  },
})
