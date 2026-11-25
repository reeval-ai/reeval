import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const node22 = defineEnvironment('node22', {
  sandbox: docker({ from: 'node:22-bookworm' }),
})
const node24 = defineEnvironment('node24', {
  sandbox: docker({ from: 'node:24-bookworm' }),
})
const also22 = defineEnvironment('also22', {
  sandbox: docker({ from: 'node:22-bookworm' }),
})
const tools = defineEnvironment('tools', {
  sandbox: docker({
    from: 'node:22-bookworm',
    install: ['apt-get update && apt-get install -y jq'],
  }),
})

export default defineEval({ environment: also22, task: async () => {} })
