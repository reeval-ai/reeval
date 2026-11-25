import { defineEval } from 'reeval'
import { grokBuild } from 'reeval/agent'

export default defineEval({
  agents: grokBuild({ model: 'grok-4.6', effort: 'high', id: 'gb' }),
  task: async () => {},
})
