import { defineEnvironment, defineEval, type PluginPart } from 'reeval'
import { pi } from 'reeval/agent'

// OpenCode, pi and fx take a plugin unpacked, each the parts it has a place for: OpenCode its
// skills, subagents, commands and MCP servers, pi its skills, commands and MCP servers, and fx its
// skills and MCP servers.
const review = (name: string, only: PluginPart[]) =>
  defineEnvironment(name, ({ plugin }) => ({
    plugins: [plugin.local('../plugins/review', { only })],
  }))
export default defineEval({
  environment: review('pi', ['skills', 'commands', 'mcp']),
  agents: pi({ model: 'google/gemini-3.8-flash' }),
  task: async () => {},
})
