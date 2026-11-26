import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { FIND_SAMPLER, watched } from './env.ts'

// The sampler reads the container's cgroup from a sibling container, so nothing here is it.
export default defineEval({
  environment: watched,
  graders: [observed('sampler', (out) => out === 'none')],
  task: async (c) => {
    c.observe('sampler', (await c.exec(FIND_SAMPLER)).stdout.trim())
  },
})
