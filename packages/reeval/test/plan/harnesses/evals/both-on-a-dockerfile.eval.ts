import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const tools = defineEnvironment('tools', {
  sandbox: docker({ dockerfile: '../docker/tools/Dockerfile' }),
})

export default defineEval({ environment: tools, task: async () => {} })
