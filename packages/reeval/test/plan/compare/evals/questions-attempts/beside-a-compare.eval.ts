import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [
    { question: 'What did the agent read first?', trajectory: 'tools' },
    { question: 'Which is cleaner?', across: 'environment', diff: true },
  ],
  task: async () => {},
})
