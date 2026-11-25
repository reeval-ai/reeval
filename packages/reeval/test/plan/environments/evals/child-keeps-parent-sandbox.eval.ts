import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const parent = defineEnvironment('parent', {
  sandbox: docker({ from: 'node:22-bookworm' }),
})
const child = parent.extend('child', {
  sandbox: docker({ from: 'node:24-bookworm' }),
})
const kept = parent.extend('kept', { env: { MODE: 'x' } })

export default defineEval({ environment: kept, task: async () => {} })
