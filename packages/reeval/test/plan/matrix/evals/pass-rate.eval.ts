import { defineEval, metric } from 'reeval'

export default defineEval({ runs: 5, target: metric(0.8), task: async () => {} })
