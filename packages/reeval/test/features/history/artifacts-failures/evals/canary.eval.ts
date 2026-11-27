import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { marked, plain } from './env.ts'

// The mistake: the baseline and the variant are swapped, so the variant has no marker.
export default defineEval({
  compare: { baseline: marked, variants: [plain] },
  graders: [hasFile('marker.txt')],
  task: async (c) => {
    await c.send('look for the marker')
  },
})
