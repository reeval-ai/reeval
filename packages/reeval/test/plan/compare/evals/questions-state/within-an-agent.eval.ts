import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [
    {
      question: 'Which arm verified its work?',
      across: 'environment',
      trajectory: 'tools',
    },
  ],
  task: async () => {},
})
