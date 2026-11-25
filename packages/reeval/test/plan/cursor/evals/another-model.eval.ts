import { defineEval } from 'reeval'
import { cursor } from 'reeval/agent'

export default defineEval({ agents: cursor({ model: 'gpt-5.2' }), task: async () => {} })
