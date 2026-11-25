import { defineEnvironment, defineEval } from 'reeval'
import { tart } from 'reeval/sandbox'

const mac = defineEnvironment('mac', {
  sandbox: tart({ image: 'ghcr.io/cirruslabs/macos-sequoia-base:15.6' }),
  egress: 'allow-all',
})

export default defineEval({ environment: mac, task: async () => {} })
