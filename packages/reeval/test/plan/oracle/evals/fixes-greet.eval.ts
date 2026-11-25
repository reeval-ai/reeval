import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const node = defineEnvironment('node', {
  sandbox: docker({ install: ['npm i -g typescript@5'] }),
})

export default defineEval({ environment: node, task: async () => {} })
