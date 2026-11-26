import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { OPEN_KVM, plain } from './env.ts'

// Must fail: without devices the container has no /dev/kvm.
export default defineEval({
  environment: plain,
  graders: [observed('kvm', (out) => out === 'opened')],
  task: async (c) => {
    c.observe('kvm', (await c.exec(OPEN_KVM)).stdout.trim())
  },
})
