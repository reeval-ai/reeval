import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, listStaged } from './env.ts'

// Must fail: a custom exclude doesn't add to the defaults, so evals/ isn't left out.
export default defineEval({
  environment: greeting,
  graders: [observed<string[]>('staged-files', (files) => !files.includes('./evals/prompts.md'))],
  task: async (c) => {
    const files = (await c.exec(listStaged)).stdout.trim().split('\n')
    c.observe('staged-files', files)
  },
})
