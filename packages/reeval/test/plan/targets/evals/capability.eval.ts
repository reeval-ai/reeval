import { capability, defineEval } from 'reeval'

export default defineEval({
  runs: 3,
  target: capability(1, { blocking: true }),
  task: async () => {},
})
