import { defineEval, regression } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled], minLift: 0.2 },
  target: regression(),
  runs: 2,
  task: async () => {},
})
