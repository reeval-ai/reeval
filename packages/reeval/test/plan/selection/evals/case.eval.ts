import { defineEval } from 'reeval'

export default defineEval({
  cases: [{ key: '1' }, { key: '2' }],
  tags: ['slow'],
  task: async () => {},
})
