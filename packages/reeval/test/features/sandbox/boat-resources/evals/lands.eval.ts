import { evaluate, expect } from 'reeval'
import { BURN, vm } from './env.ts'

// The burn runs in a container on the VM, whose readings the record's resources report.
evaluate('lands', { environments: vm }, async (c) => {
  expect(Number((await c.exec(BURN)).stdout)).toBeGreaterThanOrEqual(1)
})
