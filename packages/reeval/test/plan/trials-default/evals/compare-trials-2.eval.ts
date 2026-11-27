import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

export default defineEval({
  trials: 2,
  compare: { baseline: base, variants: [skilled] },
  task: async () => {},
})
