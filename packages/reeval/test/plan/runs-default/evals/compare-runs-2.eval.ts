import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

export default defineEval({
  runs: 2,
  compare: { control: base, variants: [skilled] },
  task: async () => {},
})
