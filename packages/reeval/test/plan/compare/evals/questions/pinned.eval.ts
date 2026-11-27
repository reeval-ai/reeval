import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [{ question: 'Which is shorter?', across: 'environment', diff: true }],
  pin: ['compare'],
  task: async () => {},
})
