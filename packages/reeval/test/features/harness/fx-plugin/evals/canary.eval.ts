import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { house } from './env.ts'

// Must fail: the style code is written by the agent following the placed skill, not by reeval.
export default defineEval({
  environment: house,
  graders: [hasFile('style.txt', /^PLOVER-27\s*$/)],
  task: async (c) => {
    await c.exec('true')
  },
})
