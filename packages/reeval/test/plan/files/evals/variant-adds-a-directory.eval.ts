import { defineEval } from 'reeval'
import { composed, whole } from './env.ts'

export default defineEval({
  compare: { baseline: whole, variants: [composed] },
  task: async () => {},
})
