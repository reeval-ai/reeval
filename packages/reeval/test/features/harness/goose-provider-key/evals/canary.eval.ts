import { defineEval } from 'reeval'
import { closed, prompt, twoKeys } from './env.ts'

// Must fail: the agent's shell has a second provider's key too.
export default defineEval({
  environment: closed,
  graders: [twoKeys],
  task: async (c) => {
    await c.send(prompt)
  },
})
