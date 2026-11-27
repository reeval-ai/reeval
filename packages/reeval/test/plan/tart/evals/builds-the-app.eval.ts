import { defineEnvironment, defineEval } from 'reeval'
import { tart } from 'reeval/sandbox'

// Pinned, so only the config's :latest image gets the moving-tag warning.
const small = defineEnvironment('small', {
  sandbox: tart({
    image: 'ghcr.io/cirruslabs/macos-sequoia-base:15.6',
    maxConcurrent: 1,
    cpus: 2,
    memory: '4g',
  }),
})

// At most two macOS VMs at once, whatever --concurrency asks for; one for the small environment.
export default defineEval({ trials: 3, task: async () => {} })
