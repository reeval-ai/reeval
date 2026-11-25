import { defineEval, expect } from 'reeval'
import { mac } from './env.ts'

// Must fail: no VM started on full, which was at its VM limit.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const r = await c.exec('pwd')
    expect(r.stdout.trim()).toMatch(/\/hosts\/full\/vms\//)
  },
})
