import { capability, defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  target: capability(),
  trials: 4,
  task: async () => {},
})
