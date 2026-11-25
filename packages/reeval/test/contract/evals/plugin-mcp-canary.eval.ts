import { defineEval, expect } from 'reeval'
import { MCP_LOG, plugged, withFakePlugin } from './probes.ts'

// The probe plugin's stdio MCP server starts in the sandbox and the agent calls its tool: the
// server logged the call, and a transcript tool names it (each harness namespaces it its own way).

// Must fail: with no turn, nothing has called the tool.
export default defineEval({
  environment: plugged,
  agents: withFakePlugin,
  tags: ['plugin'],
  task: async (c) => {
    expect((await c.readFile(MCP_LOG)) ?? '').toContain('tools/call')
  },
})
