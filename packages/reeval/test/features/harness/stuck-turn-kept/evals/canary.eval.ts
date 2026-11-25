import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// Must fail: a turn that ends inside the timeout was never cut off.
export default defineEval({
  environment: plain,
  timeout: '60s',
  task: async (c) => {
    await c.send('Run `echo step-1`, write notes.txt, then wait.')
    expect(c.turns.at(0)?.status).toBe('aborted')
  },
})
