import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { closed, prompt } from './env.ts'

// Under deny-all the harness's own hosts stay allowed: the agent works, and reaches its API.
export default defineEval({
  environment: closed,
  graders: [hasFile('reached.txt', /^200 \d{3}$/)],
  task: async (c) => {
    await c.send(prompt)
  },
})
