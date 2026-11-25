import { defineEval } from 'reeval'

export default defineEval({
  runs: 2,
  gate: { passRate: 0.5 },
  questions: [
    {
      question: 'Did the agent run the tests first?',
      choices: ['yes', 'no'],
      transcript: 'tools',
    },
  ],
  task: async () => {},
})
