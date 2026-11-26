import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { builds, ignored, note, tests } from './graders.ts'

// The attempt's score is the scored grades' weighted mean: (3 × 1 + 1 × 0) / 4.
export default defineEval({
  environment: plain,
  graders: [[builds, tests], ignored, note],
  task: async (c) => void (await c.send('build it')),
})
