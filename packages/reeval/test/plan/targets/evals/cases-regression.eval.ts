import { defineEval, regression } from 'reeval'

export default defineEval({
  cases: [{ key: 'chat' }, { key: 'rag' }],
  target: regression(0.8),
  task: async () => {},
})
