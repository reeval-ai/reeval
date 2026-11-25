import { defineEval } from 'reeval'
import { codex } from 'reeval/agent'

export default defineEval({
  agents: codex({ model: 'gpt-5.5', id: 'cx' }),
  task: async () => {},
})
