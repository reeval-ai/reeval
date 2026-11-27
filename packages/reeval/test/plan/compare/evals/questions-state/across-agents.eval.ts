import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [
    {
      question: 'Which agent verified its work?',
      across: 'agent',
      trajectory: 'tools',
    },
  ],
  task: async () => {},
})
