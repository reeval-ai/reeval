import { defineEval } from 'reeval'
import { next, pinned } from './env.ts'

export default defineEval({
  compare: { control: pinned, variants: [next] },
  task: async () => {},
})
