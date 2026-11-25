import { defineEval } from 'reeval'
import { claudeCode } from 'reeval/agent'

export default defineEval({
  agents: claudeCode({ model: 'opus', id: 'claude' }),
  task: async () => {},
})
