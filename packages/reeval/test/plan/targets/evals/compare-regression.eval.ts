import { defineEnvironment, defineEval, regression } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

// The target gates the variant; the baseline only reports.
export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  target: regression(0.8),
  trials: 2,
  task: async () => {},
})
