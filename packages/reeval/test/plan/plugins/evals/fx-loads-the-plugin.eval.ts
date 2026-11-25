import { defineEnvironment, defineEval, type PluginPart } from 'reeval'
import { fx } from 'reeval/agent'

// OpenCode, pi and fx take a plugin unpacked, each the parts it has a place for: OpenCode its
// skills, subagents, commands and MCP servers, pi its skills, commands and MCP servers, and fx its
// skills and MCP servers.
const review = (name: string, only: PluginPart[]) =>
  defineEnvironment(name, ({ plugin }) => ({
    plugins: [plugin.local('../plugins/review', { only })],
  }))
export default defineEval({
  environment: review('fx', ['skills', 'mcp']),
  agents: fx({ model: 'gpt-5.5' }),
  task: async () => {},
})
