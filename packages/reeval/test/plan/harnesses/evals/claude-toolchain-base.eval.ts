import { defineEnvironment, defineEval } from 'reeval'
import { claudeCode } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

const python = defineEnvironment('python', {
  sandbox: docker({ from: 'python:3.12-slim' }),
})

export default defineEval({
  agents: claudeCode({ model: 'claude-sonnet-5' }),
  environment: python,
  task: async () => {},
})
