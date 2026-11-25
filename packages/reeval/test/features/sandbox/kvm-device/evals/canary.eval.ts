import { defineEval, expect } from 'reeval'
import { OPEN_KVM, plain } from './env.ts'

// Must fail: without devices the container has no /dev/kvm.
export default defineEval({
  environment: plain,
  task: async (c) => {
    expect((await c.exec(OPEN_KVM)).stdout.trim()).toBe('opened')
  },
})
