import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { control: base, variants: [skilled] }

export default defineEval({
  cases: ['ada', 'grace', 'linus'],
  compare,
  runs: 4,
  task: async () => {},
})
