import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { busy, CPU_SECONDS } from './env.ts'

// Must fail: nothing burned the CPU, so the container has used well under two seconds of it.
export default defineEval({
  environment: busy,
  graders: [observed<number>('cpu-seconds', (seconds) => seconds >= 2)],
  task: async (c) => {
    c.observe('cpu-seconds', Number((await c.exec(CPU_SECONDS)).stdout))
  },
})
