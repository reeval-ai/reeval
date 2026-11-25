import { defineEval, expect } from 'reeval'
import { mac } from './env.ts'

// full is busy, so the attempt moves to free instead of failing.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const r = await c.exec('pwd')
    expect(r.stdout.trim()).toMatch(/\/hosts\/free\/vms\//)
  },
})
