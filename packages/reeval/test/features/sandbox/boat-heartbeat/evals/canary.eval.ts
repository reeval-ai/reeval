import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { HOLD, vm } from './env.ts'

// Must fail: the command prints held.
export default defineEval({
  environment: vm,
  graders: [observed('hold', (out) => out === 'released')],
  task: async (c) => {
    c.observe('hold', (await c.exec(HOLD)).stdout.trim())
  },
})
