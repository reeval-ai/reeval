import { defineEval } from 'reeval'
import { opencode } from 'reeval/agent'

export default defineEval({
  agents: [
    opencode({ model: 'anthropic/claude-haiku-4-5' }),
    opencode({ model: 'cerebras/gpt-oss-120b', id: 'opencode:cerebras' }),
  ],
  egress: 'deny-all',
  task: async () => {},
})
