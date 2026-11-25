import { defineEnvironment, defineEval } from 'reeval'

// Codex and Goose load a plugin's skills and MCP servers, so the rest is left out.
const review = defineEnvironment('review', ({ plugin }) => ({
  plugins: [plugin.local('../plugins/review', { only: ['skills', 'mcp'] })],
}))

export default defineEval({ environment: review, task: async () => {} })
