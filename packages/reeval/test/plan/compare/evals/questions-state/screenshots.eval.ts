import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [
    { question: 'Which page looks better?', across: 'environment', artifacts: ['landing'] },
  ],
  task: async () => {},
})
