import { defineEval } from 'reeval'
import { base, skilled } from './envs.ts'

// compare.control is the control cell.
export default defineEval({
  compare: { control: base, variants: [skilled] },
  task: async () => {},
})
