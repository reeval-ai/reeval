import { defineEval } from 'reeval'

export default defineEval({
  questions: [
    { question: 'Which agent explained its change better?', across: 'agent', diff: true },
  ],
  task: async () => {},
})
