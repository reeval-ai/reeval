import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  cases: [{ who: 'ada' }, { who: 'grace' }],
  caseKey: (c) => c.who,
  compare: { control: base, variants: [skilled] },
  task: async () => {},
})
