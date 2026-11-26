import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, placed } from './env.ts'

// plugin.git at a tag places the plugin as it was at that tag, not the branch head.
export default defineEval({
  environment: pinned,
  graders: [observed<string>('review.md', (text) => text.includes('the v1 checklist'))],
  task: async (c) => {
    c.observe('review.md', (await c.exec(`cat ${placed}/commands/review.md`)).stdout)
  },
})
