import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { LIMITS, unlimited } from './env.ts'

// Must fail: plain docker() has the default limits (4g memory, 1024 processes).
export default defineEval({
  environment: unlimited,
  graders: [observed('limits', (out) => out === '536870912\n100000 100000\n256\n')],
  task: async (c) => {
    c.observe('limits', (await c.exec(LIMITS)).stdout)
  },
})
