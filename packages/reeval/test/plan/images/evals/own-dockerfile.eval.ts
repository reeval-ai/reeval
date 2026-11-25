import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const withInstall = defineEnvironment('with-install', {
  sandbox: docker({
    install: ['apt-get update && apt-get install -y --no-install-recommends jq'],
  }),
})

const python = defineEnvironment('python', {
  sandbox: docker({ from: 'python:3.12-slim' }),
})

const own = defineEnvironment('own', {
  sandbox: docker({ dockerfile: '../docker/Dockerfile' }),
})

export default defineEval({ environment: own, task: async () => {} })
