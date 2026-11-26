import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { keys } from './env.ts'

// Must fail: what the eval code reads is the placeholder.
export default defineEval({
  environment: keys,
  graders: [observed('reads-placeholder', (placeholder) => placeholder === false)],
  task: async (c) => {
    c.observe('reads-placeholder', process.env.API_KEY?.startsWith('reeval_secret_') ?? false)
  },
})
