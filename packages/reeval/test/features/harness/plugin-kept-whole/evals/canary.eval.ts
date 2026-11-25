import { defineEval, expect } from 'reeval'
import { house, loaded } from './env.ts'

// Must fail: the plugin's MCP server isn't also in the agent's MCP config.
export default defineEval({
  environment: house,
  task: async (c) => {
    const turn = await c.send('read the plugin')
    expect(loaded(turn)).toContain('mcp: house:docs')
  },
})
