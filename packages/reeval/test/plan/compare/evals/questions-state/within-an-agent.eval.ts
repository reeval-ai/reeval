import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [
    {
      question: 'Which environment verified its work?',
      across: 'environment',
      trajectory: 'tools',
    },
  ],
  task: async () => {},
})
