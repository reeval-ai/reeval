import { defineEval } from 'reeval'

export default defineEval({ runs: 5, gate: { passRate: 0.8 }, task: async () => {} })
