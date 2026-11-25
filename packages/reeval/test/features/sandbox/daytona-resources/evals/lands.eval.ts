import { defineEval, expect } from 'reeval'
import { BURN, vm } from './env.ts'

// The burn runs on the VM, whose whole-machine readings the record's resources report.
export default defineEval({
  environment: vm,
  task: async (c) => {
    expect(Number((await c.exec(BURN)).stdout)).toBeGreaterThanOrEqual(1)
  },
})
