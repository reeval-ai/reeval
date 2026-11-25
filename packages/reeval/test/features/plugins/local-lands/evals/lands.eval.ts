import { defineEval, expect } from 'reeval'
import { placed, review } from './env.ts'

// plugin.local copies the plugin's kept parts into the sandbox: its subagent is there.
export default defineEval({
  environment: review,
  task: async (c) => {
    expect((await c.exec(`cat ${placed}/agents/reviewer.md`)).stdout).toContain(
      'Review the diff for the house style.',
    )
  },
})
