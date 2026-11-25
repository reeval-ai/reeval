import { defineEnvironment, defineEval } from 'reeval'
import { cursor } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

const python = defineEnvironment('python', {
  sandbox: docker({ from: 'python:3.12-slim' }),
})

export default defineEval({
  agents: cursor({ model: 'composer-2.5' }),
  environment: python,
  task: async () => {},
})
