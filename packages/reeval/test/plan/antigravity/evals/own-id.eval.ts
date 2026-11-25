import { defineEval } from 'reeval'
import { antigravity } from 'reeval/agent'

export default defineEval({
  agents: antigravity({ model: 'gemini-3.8-flash-low', id: 'agy' }),
  task: async () => {},
})
