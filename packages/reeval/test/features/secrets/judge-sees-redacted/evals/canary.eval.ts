import { defineEval, expect } from 'reeval'
import { judgeSaw, tokens } from './env.ts'

// Must fail: the judge isn't sent the check's real output.
export default defineEval({
  environment: tokens,
  task: async (c) => {
    const state = await judgeSaw(c, 'canary')
    expect(state.checks?.[0]?.stdout).toBe(process.env.REEVAL_FIXTURE_TOKEN)
  },
})
