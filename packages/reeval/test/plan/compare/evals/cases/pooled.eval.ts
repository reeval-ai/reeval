import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  cases: ['ada', 'grace', 'linus'],
  compare: { control: base, variants: [skilled], minLift: 0.2 },
  task: async () => {},
})
