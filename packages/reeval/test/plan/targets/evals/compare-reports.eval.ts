import { defineEnvironment, defineEval, metric } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

export default defineEval({
  compare: { control: base, variants: [skilled] },
  target: metric(),
  runs: 4,
  task: async () => {},
})
