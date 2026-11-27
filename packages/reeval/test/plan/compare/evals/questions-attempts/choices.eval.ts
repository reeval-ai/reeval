import { defineEval, regression } from 'reeval'

export default defineEval({
  runs: 2,
  target: regression(0.5),
  questions: [
    {
      question: 'Did the agent run the tests first?',
      choices: ['yes', 'no'],
      trajectory: 'tools',
    },
  ],
  task: async () => {},
})
