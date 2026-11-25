import { defineEval, expect } from 'reeval'
import { closed } from './env.ts'

// Must fail: expecting a host doesn't let it through.
export default defineEval({
  environment: closed,
  task: async (c) => {
    await c.send('call home')
    expect((await c.readFile('reached.txt'))?.trim()).toMatch(/^200 \d{3}$/)
  },
})
