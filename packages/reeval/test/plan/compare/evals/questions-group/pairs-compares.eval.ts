import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  questions: [{ question: 'Which is shorter?', across: 'environment', diff: true }],
  compare: { baseline: base, variants: [skilled] },
  task: async () => {},
})
