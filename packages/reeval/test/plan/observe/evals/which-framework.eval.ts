import { defineEval } from 'reeval'

export default defineEval({
  cases: [{ key: 'chat' }, { key: 'rag' }],
  gate: 'observe',
  task: async () => {},
})
