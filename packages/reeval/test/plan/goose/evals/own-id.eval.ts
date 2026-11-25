import { defineEval } from 'reeval'
import { goose } from 'reeval/agent'

export default defineEval({
  agents: goose({ model: 'google/gemini-3.8-pro', id: 'gs' }),
  task: async () => {},
})
