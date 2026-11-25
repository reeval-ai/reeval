import { defineEval, expect } from 'reeval'
import { kvm, OPEN_KVM } from './env.ts'

// docker({ devices: ['kvm'] }): the unprivileged reeval user opens /dev/kvm read-write.
export default defineEval({
  environment: kvm,
  task: async (c) => {
    expect((await c.exec(OPEN_KVM)).stdout.trim()).toBe('opened')
  },
})
