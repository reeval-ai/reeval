import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { builds, ignored, note, strict, tests } from './graders.ts'

export default defineEval({
  environment: plain,
  // The mistake: strict is required and scores 0.5, so the trial scores 0.
  graders: [[builds, tests], ignored, note, strict],
  task: async (c) => void (await c.send('build it')),
})
