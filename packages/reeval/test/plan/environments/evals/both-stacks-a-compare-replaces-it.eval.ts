import { defineEnvironment, defineEval } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

const next = defineEnvironment('nextjs', { sandbox: docker({ from: 'node:24-bookworm' }) })
const python = defineEnvironment('python', { env: { STACK: 'python' } })
const plain = defineEnvironment('plain', {})

export default defineEval({
  compare: { baseline: plain, variants: [next] },
  task: async () => {},
})
