import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [{ question: 'What did the agent change?', diff: true }],
  task: async () => {},
})
