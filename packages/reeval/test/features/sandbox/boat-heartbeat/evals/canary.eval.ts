import { defineEval, expect } from 'reeval'
import { HOLD, vm } from './env.ts'

// Must fail: the command prints held.
export default defineEval({
  environment: vm,
  task: async (c) => {
    expect((await c.exec(HOLD)).stdout.trim()).toBe('released')
  },
})
