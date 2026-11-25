import { defineEval, expect } from 'reeval'
import { house, loaded } from './env.ts'

// Must fail: Goose takes the plugin's MCP server in its own config.
export default defineEval({
  environment: house,
  task: async (c) => {
    const turn = await c.send('read the plugin')
    expect(loaded(turn)).not.toContain('mcp: house:docs')
  },
})
