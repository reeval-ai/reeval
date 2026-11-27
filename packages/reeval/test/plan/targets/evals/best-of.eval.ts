import { defineEval, regression } from 'reeval'

// Each hit is a trial that meets the threshold; a majority of hits passes.
export default defineEval({ trials: { bestOf: 3 }, target: regression(0.8), task: async () => {} })
