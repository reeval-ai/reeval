import { defineEnvironment, defineEval, regression } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

// The target gates the variant; the control only reports.
export default defineEval({
  compare: { control: base, variants: [skilled] },
  target: regression(0.8),
  runs: 2,
  task: async () => {},
})
