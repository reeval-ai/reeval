import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { empty } from './env.ts'

export default defineEval({
  environment: empty,
  // The mistake: the empty environment doesn't get the variant's files.
  graders: [hasFile('from-variant.txt', 'variant-only')],
  task: async (c) => {
    await c.exec('true')
  },
})
