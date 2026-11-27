import { defineEnvironment, defineEval } from 'reeval'
import { base } from './envs.ts'

const peer = defineEnvironment('peer', { env: { MODE: 'peer' } })

// Compare names both environments.
export default defineEval({
  compare: { baseline: base, variants: [peer] },
  task: async () => {},
})
