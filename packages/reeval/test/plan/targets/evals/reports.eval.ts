import { defineEval } from 'reeval'

// capability() by default: every cell gated any, and a miss only reports.
export default defineEval({ runs: 3, task: async () => {} })
