import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

// Unset trials: a compare runs 4 a side, anything else once (a compare with cases too, since its
// lift pairs cases); any level that sets trials wins.
export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  task: async () => {},
})
