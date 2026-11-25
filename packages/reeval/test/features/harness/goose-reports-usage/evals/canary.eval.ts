import { defineEval, expect } from 'reeval'
import { plain, prompt } from './env.ts'

// Must fail: the turn reports its tokens, so its usage isn't null.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send(prompt)
    expect(turn.usage).toBeNull()
  },
})
