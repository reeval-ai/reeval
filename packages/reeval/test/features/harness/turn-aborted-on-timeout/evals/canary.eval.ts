import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// Must fail: a turn that ends inside the timeout is completed, not aborted.
export default defineEval({
  environment: plain,
  timeout: '60s',
  task: async (c) => {
    await c.send('Reply with the word done.')
    expect(c.turns.at(0)?.status).toBe('aborted')
  },
})
