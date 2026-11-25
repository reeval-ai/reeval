import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [{ question: 'Which handles state more cleanly?', across: 'environment', diff: true }],
  task: async () => {},
})
