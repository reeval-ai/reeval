import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { kvm, OPEN_KVM } from './env.ts'

// docker({ devices: ['kvm'] }): the unprivileged reeval user opens /dev/kvm read-write.
export default defineEval({
  environment: kvm,
  graders: [observed('kvm', (out) => out === 'opened')],
  task: async (c) => {
    c.observe('kvm', (await c.exec(OPEN_KVM)).stdout.trim())
  },
})
