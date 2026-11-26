import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { baseline, variant } from './env.ts'

export default defineEval({
  compare: { control: baseline, variants: [variant] },
  // The mistake: compare does not layer the baseline into the variant.
  graders: [hasFile('from-baseline.txt', 'baseline-only')],
  task: async (c) => {
    await c.exec('true')
  },
})
