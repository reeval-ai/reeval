import { defineEnvironment, defineEval } from 'reeval'
import { calledMcp, hasFile } from 'reeval/graders'

// The package in ./project, and the release plugin's skill and MCP server. Its command stays
// out: `only` places just the parts listed.
const app = defineEnvironment('acme-math', ({ directory, plugin }) => ({
  files: directory('./project'),
  plugins: [plugin.local('./plugins/release', { only: ['skills', 'mcp'] })],
}))

export default defineEval({
  environment: app,
  graders: [
    // A plugin's MCP servers are named <plugin>:<server>.
    calledMcp('release:releases', 'next_version'),
    hasFile('package.json', /"version": "1\.3\.0"/),
    hasFile('CHANGELOG.md', /^## 1\.3\.0\s+- feat: add multiply/),
  ],
  task: async (c) => {
    await c.send('Prepare the next release.')
  },
})
