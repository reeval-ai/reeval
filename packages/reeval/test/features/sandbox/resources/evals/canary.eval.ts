import { defineEval, expect } from 'reeval'
import { busy, CPU_SECONDS } from './env.ts'

// Must fail: nothing burned the CPU, so the container has used well under two seconds of it.
export default defineEval({
  environment: busy,
  task: async (c) => {
    expect(Number((await c.exec(CPU_SECONDS)).stdout)).toBeGreaterThanOrEqual(2)
  },
})
