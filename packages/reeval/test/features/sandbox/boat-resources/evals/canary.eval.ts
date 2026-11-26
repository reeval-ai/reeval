import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { BURN, vm } from './env.ts'

// Must fail: the burn prints the VM's CPU count, which is never 0.
export default defineEval({
  environment: vm,
  graders: [observed('cpus', (cpus) => cpus === 0)],
  task: async (c) => {
    c.observe('cpus', Number((await c.exec(BURN)).stdout))
  },
})
