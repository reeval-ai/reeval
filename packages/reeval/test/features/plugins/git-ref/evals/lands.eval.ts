import { defineEval, expect } from 'reeval'
import { pinned, placed } from './env.ts'

// plugin.git at a tag places the plugin as it was at that tag, not the branch head.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect((await c.exec(`cat ${placed}/commands/review.md`)).stdout).toContain('the v1 checklist')
  },
})
