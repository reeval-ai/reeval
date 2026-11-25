import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled], gate: 'all', minLift: 0.2 },
  runs: 2,
  task: async () => {},
})
