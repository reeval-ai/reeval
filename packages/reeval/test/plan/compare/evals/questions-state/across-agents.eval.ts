import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [
    {
      question: 'Which agent verified its work?',
      across: 'agent',
      transcript: 'tools',
    },
  ],
  task: async () => {},
})
