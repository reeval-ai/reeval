import { defineEval } from 'reeval'
import { noUsage, plain, prompt } from './env.ts'

// Must fail: the turn reports its tokens, so its usage isn't null.
export default defineEval({
  environment: plain,
  graders: [noUsage],
  task: async (c) => {
    await c.send(prompt)
  },
})
