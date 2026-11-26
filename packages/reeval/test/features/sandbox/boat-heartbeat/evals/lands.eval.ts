import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { HOLD, vm } from './env.ts'

// While the command runs, the run's heartbeats name the machine the attempt holds a slot on.
export default defineEval({
  environment: vm,
  graders: [observed('hold', (out) => out === 'held')],
  task: async (c) => {
    c.observe('hold', (await c.exec(HOLD)).stdout.trim())
  },
})
