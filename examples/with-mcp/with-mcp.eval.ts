import { defineEnvironment, defineEval } from 'reeval'
import { calledMcp, hasFile } from 'reeval/graders'

// The package in ./project and the releases MCP server, which the agent starts in the sandbox.
const app = defineEnvironment('acme-cli', ({ directory, file, mcp }) => ({
  files: { ...directory('./project'), 'mcp/releases.mjs': file('./mcp/releases.mjs') },
  mcp: { releases: mcp.stdio('node', ['mcp/releases.mjs']) },
}))

export default defineEval({
  environment: app,
  graders: [
    calledMcp('releases', 'latest_version'),
    hasFile('package.json', /"version": "2\.4\.0"/),
  ],
  task: async (c) => {
    await c.send(
      "Set package.json's version to the latest acme-cli release. " +
        "The releases MCP server's latest_version tool knows it.",
    )
  },
})
