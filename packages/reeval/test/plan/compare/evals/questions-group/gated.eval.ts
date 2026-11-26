import { defineEval, regression } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [{ question: 'Which handles state more cleanly?', across: 'environment', diff: true }],
  runs: 2,
  target: regression(0.5),
  task: async () => {},
})
