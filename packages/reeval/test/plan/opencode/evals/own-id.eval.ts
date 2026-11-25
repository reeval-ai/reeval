import { defineEval } from 'reeval'
import { opencode } from 'reeval/agent'

export default defineEval({
  agents: opencode({ model: 'google/gemini-3.8-pro', id: 'oc' }),
  task: async () => {},
})
