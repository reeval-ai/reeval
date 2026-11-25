import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

export default defineEval({
  environment: defineEnvironment('python', {
    sandbox: docker({ from: 'python:3.12-slim' }),
  }),
  egress: 'deny-all',
  task: async () => {},
})
