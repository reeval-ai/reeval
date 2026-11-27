import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [
    {
      question: 'Which follows the house style more closely?',
      across: ['environment', 'agent'],
      diff: true,
    },
  ],
  task: async () => {},
})
