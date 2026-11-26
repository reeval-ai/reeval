import { defineEval } from 'reeval'

export default defineEval({
  questions: [{ question: 'What did the agent say it did?', task: true, output: true, diff: true }],
  task: async () => {},
})
