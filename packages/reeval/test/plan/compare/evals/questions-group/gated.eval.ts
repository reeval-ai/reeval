import { defineEval, regression } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [{ question: 'Which handles state more cleanly?', across: 'environment', diff: true }],
  trials: 2,
  target: regression(0.5),
  task: async () => {},
})
