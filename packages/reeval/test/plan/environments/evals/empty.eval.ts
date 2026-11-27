import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const bare = defineEnvironment('bare', {})
const skilled = defineEnvironment('skilled', {
  sandbox: docker({ from: 'node:24-bookworm' }),
})

// An empty baseline runs on the cascaded sandbox, not on its variant's.
export default defineEval({
  compare: { baseline: bare, variants: [skilled] },
  task: async () => {},
})
