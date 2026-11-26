import { capability, defineEval } from 'reeval'

export default defineEval({ runs: 3, target: capability(0.5), task: async () => {} })
