import { defineEnvironment, defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

const next = defineEnvironment('nextjs', { sandbox: docker({ from: 'node:24-bookworm' }) })
const python = defineEnvironment('python', { env: { STACK: 'python' } })
const plain = defineEnvironment('plain', {})

// Each environment is its own cell beside each harness: 2 × 2.
export default defineEval({
  environment: [next, python],
  agents: [fakeAgent({ id: 'one' }), fakeAgent({ id: 'two' })],
  task: async () => {},
})
