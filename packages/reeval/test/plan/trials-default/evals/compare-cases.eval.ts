import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

export default defineEval({
  cases: [{ key: 'a' }, { key: 'b' }],
  compare: { baseline: base, variants: [skilled] },
  task: async () => {},
})
