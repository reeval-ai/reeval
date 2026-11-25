import { defineEval, expect } from 'reeval'
import { greeting, listStaged } from './env.ts'

// Must fail: a custom exclude doesn't add to the defaults, so evals/ isn't left out.
export default defineEval({
  environment: greeting,
  task: async (c) => {
    const files = (await c.exec(listStaged)).stdout.trim().split('\n')
    expect(files).not.toContain('./evals/prompts.md')
  },
})
