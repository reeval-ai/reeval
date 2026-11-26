import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { doubled, SWAP } from './env.ts'

// Must fail: without swap, docker({ memory: '512m' }) gets 512 MiB of swap, not 256.
export default defineEval({
  environment: doubled,
  graders: [observed('swap', (out) => out === '268435456\n')],
  task: async (c) => {
    c.observe('swap', (await c.exec(SWAP)).stdout)
  },
})
