import { defineEval } from 'reeval'
import { closed, onePlaceholder, prompt } from './env.ts'

// The agent's shell has the model's provider's key, as a placeholder, and no other provider's.
export default defineEval({
  environment: closed,
  graders: [onePlaceholder],
  task: async (c) => {
    await c.send(prompt)
  },
})
