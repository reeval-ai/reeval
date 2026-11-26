import { defineEval, regression } from 'reeval'

export default defineEval({ runs: { bestOf: 5 }, target: regression(), task: async () => {} })
