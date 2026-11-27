import { defineEval } from 'reeval'
import { base, skilled, terse } from './envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled, terse] },
  trials: 3,
  task: async () => {},
})
