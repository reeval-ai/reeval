import { defineEval } from 'reeval'

// A skipped eval asks nothing, so the pairwise question needs nothing to vary.
export default defineEval({
  questions: [{ question: 'Which is shorter?', across: 'environment', diff: true }],
  skip: true,
  task: async () => {},
})
