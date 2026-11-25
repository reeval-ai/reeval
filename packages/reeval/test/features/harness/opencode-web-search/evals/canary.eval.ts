import { defineEval, expect } from 'reeval'
import { closed, prompt } from './env.ts'

// Must fail: the agent searched the web.
export default defineEval({
  environment: closed,
  task: async (c) => {
    const turn = await c.send(prompt)
    expect(turn).not.toHaveSearched()
  },
})
