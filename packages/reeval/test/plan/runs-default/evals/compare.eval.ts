import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })
const skilled = base.extendEnvironment('skilled', { env: { MODE: 'skilled' } })

// Unset runs: a compare runs 4 a side, anything else once (a compare with cases too, since its
// lift pairs cases); any level that sets runs wins.
export default defineEval({
  compare: { control: base, variants: [skilled] },
  task: async () => {},
})
