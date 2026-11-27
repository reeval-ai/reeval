import { defineEval, regression } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled], minLift: 0.2 },
  target: regression(),
  trials: 2,
  task: async () => {},
})
