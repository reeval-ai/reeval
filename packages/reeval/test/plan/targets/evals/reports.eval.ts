import { defineEval } from 'reeval'

// metric() by default: every cell ran and none gated.
export default defineEval({ runs: 3, task: async () => {} })
