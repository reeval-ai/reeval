import { defineEval } from 'reeval'
import { base, skilled, terse } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled, terse] },
  task: async () => {},
})
