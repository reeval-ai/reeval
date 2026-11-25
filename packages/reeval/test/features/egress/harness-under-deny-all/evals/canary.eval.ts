import { defineEval, expect } from 'reeval'
import { closed, reach } from './env.ts'

// Must fail: any other host is refused at CONNECT, with no turn needed.
export default defineEval({
  environment: closed,
  task: async (c) => {
    await c.exec(reach('registry.npmjs.org'))
    expect((await c.readFile('reached.txt'))?.trim()).toMatch(/^200 \d{3}$/)
  },
})
