import { defineEval } from 'reeval'
import { fx } from 'reeval/agent'

export default defineEval({
  agents: fx({ model: 'gpt-4.1-mini', id: 'fx-openai' }),
  task: async () => {},
})
