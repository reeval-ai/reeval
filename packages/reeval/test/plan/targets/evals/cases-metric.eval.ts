import { defineEval, metric } from 'reeval'

export default defineEval({
  cases: [{ key: 'chat' }, { key: 'rag' }],
  target: metric(0.8),
  task: async () => {},
})
