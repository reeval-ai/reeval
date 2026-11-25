import { defineEval, expect } from 'reeval'
import { greeting, listStaged } from './env.ts'

// Must fail: the skill's eval prompts are excluded by default.
export default defineEval({
  environment: greeting,
  task: async (c) => {
    const files = (await c.exec(listStaged)).stdout.trim().split('\n')
    expect(files).toContain('./evals/prompts.md')
  },
})
