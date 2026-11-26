import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { BURN, vm } from './env.ts'

// The burn runs on the VM, whose whole-machine readings the record's resources report.
export default defineEval({
  environment: vm,
  graders: [observed<number>('cpus', (cpus) => cpus >= 1)],
  task: async (c) => {
    c.observe('cpus', Number((await c.exec(BURN)).stdout))
  },
})
