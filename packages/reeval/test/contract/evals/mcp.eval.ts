import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { MCP_LOG, prompts, stamped, toolNames, withFakeMcp } from './probes.ts'

// The environment's stdio MCP server is started in the sandbox and the agent calls its tool: the
// server logged the call, and the trajectory names it mcp__<server>__<tool>. Tagged so a harness
// with no MCP client runs the rest with --tag '!mcp': its plan refuses these outright.
export default defineEval({
  environment: stamped,
  agents: withFakeMcp,
  tags: ['mcp'],
  task: async (c) => {
    const turn = await c.send(prompts.mcp)
    assert.ok(
      ((await c.readFile(MCP_LOG)) ?? '').includes('tools/call'),
      'the MCP server logged a tools/call',
    )
    assert.ok(toolNames(turn).includes('mcp__stamp__house_stamp'))
  },
})
