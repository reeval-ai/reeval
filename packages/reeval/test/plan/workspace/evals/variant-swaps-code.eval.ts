import { defineEval } from 'reeval'
import { next, pinned } from './env.ts'

export default defineEval({
  compare: { baseline: pinned, variants: [next] },
  task: async () => {},
})
