import { capability, defineEval } from 'reeval'

export default defineEval({
  trials: 3,
  target: capability(1, { blocking: true }),
  task: async () => {},
})
