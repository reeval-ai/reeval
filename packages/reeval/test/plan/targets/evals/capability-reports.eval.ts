import { capability, defineEval } from 'reeval'

export default defineEval({ trials: 3, target: capability(0.5), task: async () => {} })
