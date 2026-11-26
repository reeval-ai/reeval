import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { FIND_SAMPLER, watched } from './env.ts'

// Must fail: there is no sampler in the container to kill.
export default defineEval({
  environment: watched,
  graders: [observed('sampler', (out) => out === 'killed')],
  task: async (c) => {
    c.observe('sampler', (await c.exec(FIND_SAMPLER)).stdout.trim())
  },
})
