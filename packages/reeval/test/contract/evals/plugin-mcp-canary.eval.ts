import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { MCP_LOG, plugged, withFakePlugin } from './probes.ts'

// The probe plugin's stdio MCP server starts in the sandbox and the agent calls its tool: the
// server logged the call, and a trajectory tool names it (each harness namespaces it its own way).

// Must fail: with no turn, nothing has called the tool.
export default defineEval({
  environment: plugged,
  agents: withFakePlugin,
  tags: ['plugin'],
  task: async (c) => {
    assert.ok(
      ((await c.readFile(MCP_LOG)) ?? '').includes('tools/call'),
      'the MCP server logged a tools/call',
    )
  },
})
