import { defineEval, expect } from 'reeval'
import { pinned, placed } from './env.ts'

// Must fail: only: ['skills', 'mcp'] leaves the plugin's hooks out.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect((await c.exec(`cat ${placed}/hooks/hooks.json`)).stdout).toContain('SessionStart')
  },
})
