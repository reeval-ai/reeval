import { defineEval } from 'reeval'

export default defineEval({
  questions: [
    {
      question: 'What did the agent check before it finished?',
      task: true,
      output: true,
      diff: true,
      trajectory: true,
    },
  ],
  task: async () => {},
})
