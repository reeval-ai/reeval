import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { control: base, variants: [skilled] }

export default defineEval({
  cases: [{ key: 'ada' }, { key: 'grace' }, { key: 'linus' }],
  compare,
  runs: 4,
  task: async () => {},
})
