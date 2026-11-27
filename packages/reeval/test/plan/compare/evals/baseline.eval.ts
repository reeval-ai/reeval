import { defineEval } from 'reeval'
import { base, skilled } from './envs.ts'

// compare.baseline is the baseline cell.
export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  task: async () => {},
})
