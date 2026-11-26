import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { BURN, busy, CPU_SECONDS } from './env.ts'

// The burn uses the CPU and memory the record's resources then report.
export default defineEval({
  environment: busy,
  graders: [observed<number>('cpu-seconds', (seconds) => seconds >= 2)],
  task: async (c) => {
    await c.exec(BURN)
    c.observe('cpu-seconds', Number((await c.exec(CPU_SECONDS)).stdout))
  },
})
