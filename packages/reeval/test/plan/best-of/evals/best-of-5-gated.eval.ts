import { defineEval, regression } from 'reeval'

export default defineEval({ trials: { bestOf: 5 }, target: regression(), task: async () => {} })
