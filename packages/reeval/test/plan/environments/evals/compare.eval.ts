import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const plain = defineEnvironment('plain', { sandbox: docker({ from: 'node:22-bookworm' }) })
const skilled = defineEnvironment('skilled', {
  sandbox: docker({ from: 'node:24-bookworm' }),
})

// compare.baseline replaces the config's `environments`.
export default defineEval({
  compare: { baseline: plain, variants: [skilled] },
  task: async () => {},
})
