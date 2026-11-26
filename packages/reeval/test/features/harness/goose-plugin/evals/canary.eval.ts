import { defineEval, defineGrader } from 'reeval'
import { house, loaded } from './env.ts'

const mcpLeftOut = defineGrader('mcp-left-out', {
  grade: (c) => loaded(c.turns[0]),
  score: (said) => (said.includes('mcp: house:docs') ? 0 : 1),
})

// Must fail: Goose takes the plugin's MCP server in its own config.
export default defineEval({
  environment: house,
  graders: [mcpLeftOut],
  task: async (c) => {
    await c.send('read the plugin')
  },
})
