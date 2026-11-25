import { defineEval } from 'reeval'
import { base, skilled, terse } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled, terse] },
  questions: [
    {
      question: 'Which handles state more cleanly?',
      across: ['environment', 'agent'],
      diff: true,
    },
    {
      question: 'Which follows the house style more closely?',
      model: 'google/gemini-3.8-flash',
      across: 'environment',
      diff: true,
    },
  ],
  task: async () => {},
})
