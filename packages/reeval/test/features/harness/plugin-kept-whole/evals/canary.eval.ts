import { defineEval } from 'reeval'
import { house, mcpInConfig } from './env.ts'

// Must fail: the plugin's MCP server isn't also in the agent's MCP config.
export default defineEval({
  environment: house,
  graders: [mcpInConfig],
  task: async (c) => {
    await c.send('read the plugin')
  },
})
