import { defineEval, expect } from 'reeval'
import { doubled, SWAP } from './env.ts'

// Must fail: without swap, docker({ memory: '512m' }) gets 512 MiB of swap, not 256.
export default defineEval({
  environment: doubled,
  task: async (c) => {
    expect((await c.exec(SWAP)).stdout).toBe('268435456\n')
  },
})
