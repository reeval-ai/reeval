import { defineEval, expect } from 'reeval'
import { HOLD, vm } from './env.ts'

// While the command runs, the run's heartbeats name the machine the attempt holds a slot on.
export default defineEval({
  environment: vm,
  task: async (c) => {
    expect((await c.exec(HOLD)).stdout.trim()).toBe('held')
  },
})
