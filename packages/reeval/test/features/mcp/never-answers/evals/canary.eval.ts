import { defineEval, expect } from 'reeval'
import { prompt, quick } from './env.ts'

// Must fail: a server that answers isn't timed out, so the turn's status is completed.
export default defineEval({
  environment: quick,
  task: async (c) => {
    const turn = await c.send(prompt)
    expect(turn.status).toBe('error')
  },
})
