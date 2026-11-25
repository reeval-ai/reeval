import { defineEval, expect } from 'reeval'
import { closed, prompt } from './env.ts'

// Under deny-all the harness's own hosts stay allowed: the agent works, and reaches its API.
export default defineEval({
  environment: closed,
  task: async (c) => {
    await c.send(prompt)
    expect((await c.readFile('reached.txt'))?.trim()).toMatch(/^200 \d{3}$/)
  },
})
