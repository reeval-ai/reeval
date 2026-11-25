import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { control: base, variants: [skilled] }

export default defineEval({
  cases: [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }, { key: 'e' }, { key: 'f' }],
  compare,
  task: async () => {},
})
