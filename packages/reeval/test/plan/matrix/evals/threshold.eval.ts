import { defineEval, regression } from 'reeval'

export default defineEval({ trials: 5, target: regression(0.8), task: async () => {} })
