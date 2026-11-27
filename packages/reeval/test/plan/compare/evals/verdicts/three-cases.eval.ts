import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { baseline: base, variants: [skilled] }

export default defineEval({
  cases: [{ key: 'ada' }, { key: 'grace' }, { key: 'linus' }],
  compare,
  trials: 4,
  task: async () => {},
})
