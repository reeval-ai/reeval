import { defineEval, regression } from 'reeval'

export default defineEval({ runs: 5, target: regression(0.8), task: async () => {} })
