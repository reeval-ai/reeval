import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { LIMITS, plain } from './env.ts'

// docker({ memory, cpus, pids }) reach the container's cgroup.
export default defineEval({
  environment: plain,
  graders: [observed('limits', (out) => out === '536870912\n100000 100000\n256\n')],
  task: async (c) => {
    c.observe('limits', (await c.exec(LIMITS)).stdout)
  },
})
