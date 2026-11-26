import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain, SWAP } from './env.ts'

// docker({ swap }) reaches the container's cgroup, on top of memory.
export default defineEval({
  environment: plain,
  graders: [observed('swap', (out) => out === '268435456\n')],
  task: async (c) => {
    c.observe('swap', (await c.exec(SWAP)).stdout)
  },
})
