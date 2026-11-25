import { defineEval, expect } from 'reeval'
import { FIND_SAMPLER, watched } from './env.ts'

// The sampler reads the container's cgroup from a sibling container, so nothing here is it.
export default defineEval({
  environment: watched,
  task: async (c) => {
    expect((await c.exec(FIND_SAMPLER)).stdout.trim()).toBe('none')
  },
})
