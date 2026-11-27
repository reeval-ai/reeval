import { defineEval, regression } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  cases: [{ key: 'ada' }, { key: 'grace' }, { key: 'linus' }],
  compare: { baseline: base, variants: [skilled], minLift: 0.2 },
  target: regression(),
  task: async () => {},
})
