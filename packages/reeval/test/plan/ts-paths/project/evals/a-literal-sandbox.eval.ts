import { defineEnvironment, defineEval } from 'reeval'

// Relative to this file, as docker() and fakeSandbox() would resolve them here.
const own = defineEnvironment('own', {
  sandbox: { kind: 'docker', dockerfile: './images/Dockerfile' },
})

export default defineEval({
  sandbox: { kind: 'docker', dockerfile: 'images/Dockerfile' },
  task: async () => {},
})
