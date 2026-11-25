import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { control: base, variants: [skilled] }
const across = 'environment' as const

export default defineEval({
  compare,
  questions: [{ question: 'Which is clearer?', across, diff: true }],
  task: async () => {},
})
