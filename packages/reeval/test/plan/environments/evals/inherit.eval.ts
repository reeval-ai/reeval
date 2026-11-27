import { defineEnvironment, defineEval } from 'reeval'

const plain = defineEnvironment('plain', {})
const withMode = defineEnvironment('with-mode', { env: { MODE: 'x' } })

// Named compare environments omit sandbox: they use the root machine, not the config
// environment's image (node:22). A named env is a total override.
export default defineEval({
  compare: { baseline: plain, variants: [withMode] },
  task: async () => {},
})
