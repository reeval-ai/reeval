import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, placed } from './env.ts'

// Must fail: only: ['skills', 'mcp'] leaves the plugin's hooks out.
export default defineEval({
  environment: pinned,
  graders: [observed<string>('hooks.json', (text) => text.includes('SessionStart'))],
  task: async (c) => {
    c.observe('hooks.json', (await c.exec(`cat ${placed}/hooks/hooks.json`)).stdout)
  },
})
