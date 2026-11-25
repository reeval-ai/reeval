import { defineEval } from 'reeval'

// Every cell ran, none gated, and no pass^k hint however many runs.
export default defineEval({ gate: 'observe', runs: 3, task: async () => {} })
