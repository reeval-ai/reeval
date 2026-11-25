import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

export default defineEval({
  compare: { control: base, variants: [skilled], gate: 'observe' },
  runs: 2,
  task: async () => {},
})
