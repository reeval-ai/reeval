import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const bare = defineEnvironment('bare', {})
const skilled = defineEnvironment('skilled', {
  sandbox: docker({ from: 'node:24-bookworm' }),
})

// An empty control runs on the cascaded sandbox, not on its variant's.
export default defineEval({
  compare: { control: bare, variants: [skilled] },
  task: async () => {},
})
