import { defineEval } from 'reeval'
import { composed, whole } from './env.ts'

export default defineEval({
  compare: { control: whole, variants: [composed] },
  task: async () => {},
})
