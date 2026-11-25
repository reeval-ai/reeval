import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { control: base, variants: [skilled] }
const across = 'environment' as const

export default defineEval({
  question: { model: 'openai/gpt-5.5' },
  compare,
  questions: [{ question: 'Which is shorter?', across, diff: true }],
  task: async () => {},
})
