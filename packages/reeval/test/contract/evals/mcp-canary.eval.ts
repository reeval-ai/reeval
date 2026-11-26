import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { MCP_LOG, stamped, withFakeMcp } from './probes.ts'

// The environment's stdio MCP server is started in the sandbox and the agent calls its tool: the
// server logged the call, and the transcript names it mcp__<server>__<tool>. Tagged so a harness
// with no MCP client runs the rest with --tag '!mcp': its plan refuses these outright.

// Must fail: with no turn, nothing has called the tool.
export default defineEval({
  environment: stamped,
  agents: withFakeMcp,
  tags: ['mcp'],
  task: async (c) => {
    assert.ok(
      ((await c.readFile(MCP_LOG)) ?? '').includes('tools/call'),
      'the MCP server logged a tools/call',
    )
  },
})
