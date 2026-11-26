import { defineEval, regression } from 'reeval'

// Each hit is an attempt that meets the threshold; a majority of hits passes.
export default defineEval({ runs: { bestOf: 3 }, target: regression(0.8), task: async () => {} })
