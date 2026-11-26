import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  cases: [
    { key: 'ada', who: 'Ada Lovelace' },
    { key: 'grace', who: 'Grace Hopper' },
  ],
  compare: { control: base, variants: [skilled] },
  task: async () => {},
})
