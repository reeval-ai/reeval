import { defineEnvironment, defineEval } from 'reeval'
import { claudeCode, cursor } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

const toolchain = defineEnvironment('toolchain', {
  sandbox: docker({ from: 'python:3.12-slim', install: ['pip install pytest'] }),
  egress: 'allow-all',
})
const prebuilt = defineEnvironment('prebuilt', {
  sandbox: docker({ id: 'agent', image: 'ghcr.io/acme/agent:1' }),
  egress: 'allow-all',
})

export default defineEval({ egress: 'allow-all', task: async () => {} })
