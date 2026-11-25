import { defineEnvironment, defineEval } from 'reeval'
import { base } from './envs.ts'

const peer = defineEnvironment('peer', { env: { MODE: 'peer' } })

// Compare names both arms.
export default defineEval({
  compare: { control: base, variants: [peer] },
  task: async () => {},
})
