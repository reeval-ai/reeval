import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { baseline: base, variants: [skilled] }
const across = 'environment' as const

export default defineEval({
  question: { model: 'google/gemini-3.8-flash' },
  compare,
  questions: [{ question: 'Which is cleaner?', across, diff: true }],
  task: async () => {},
})
