import { defineEval } from 'reeval'
import { base, skilled } from './envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled], agents: ['b'] },
  pin: ['compare'],
  task: async () => {},
})
