import { defineEval } from 'reeval'
import { cursor } from 'reeval/agent'

// The data forms of a harness edit plan the same cells as the functions they stand for.
const fast = cursor({ model: 'composer-2', id: 'fast' })

export default defineEval({ agents: (h) => [...h, fast], task: async () => {} })
