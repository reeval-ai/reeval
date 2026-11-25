import { defineEnvironment, defineEval } from 'reeval'
import { claudeCode } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

const tools = defineEnvironment('tools', {
  sandbox: docker({ dockerfile: '../docker/tools/Dockerfile' }),
})

export default defineEval({
  agents: (inherited) => [...inherited, claudeCode({ model: 'claude-sonnet-5' })],
  environment: tools,
  task: async () => {},
})
