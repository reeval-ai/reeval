import { defineEval } from 'reeval'

// Without across, a question is asked of each attempt on its own, with or without a compare.
export default defineEval({
  questions: [{ question: 'How did the agent find the failing test?', trajectory: true }],
  task: async () => {},
})
