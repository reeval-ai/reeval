import { defineEval } from 'reeval'
import { opencode } from 'reeval/agent'

export default defineEval({
  agents: opencode({ model: 'amazon-bedrock/global.anthropic.claude-haiku-4-5' }),
  egress: 'deny-all',
  task: async () => {},
})
