import { defineEval } from 'reeval'
import { pi } from 'reeval/agent'

export default defineEval({
  agents: pi({ model: 'google/gemini-3.8-pro', id: 'pim' }),
  task: async () => {},
})
