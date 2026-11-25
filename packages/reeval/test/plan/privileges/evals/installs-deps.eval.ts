import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const deps = defineEnvironment('deps', {
  sandbox: docker({ root: true, capabilities: ['NET_ADMIN'] }),
})

// Root and a capability on the eval's environment: a warning for each.
export default defineEval({ environment: deps, task: async () => {} })
