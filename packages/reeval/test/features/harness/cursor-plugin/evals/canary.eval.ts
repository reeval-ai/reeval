import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { house } from './env.ts'

// Must fail: the codeword is written by the agent following the unpacked rule, not by reeval.
export default defineEval({
  environment: house,
  graders: [hasFile('codeword.txt', /^SAFFRON-73\s*$/)],
  task: async (c) => {
    await c.exec('true')
  },
})
