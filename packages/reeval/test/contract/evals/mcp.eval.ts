import { defineEval, expect } from 'reeval'
import { MCP_LOG, prompts, stamped, toolNames, withFakeMcp } from './probes.ts'

// The environment's stdio MCP server is started in the sandbox and the agent calls its tool: the
// server logged the call, and the transcript names it mcp__<server>__<tool>. Tagged so a harness
// with no MCP client runs the rest with --tag '!mcp': its plan refuses these outright.
export default defineEval({
  environment: stamped,
  agents: withFakeMcp,
  tags: ['mcp'],
  task: async (c) => {
    const turn = await c.send(prompts.mcp)
    expect((await c.readFile(MCP_LOG)) ?? '').toContain('tools/call')
    expect(toolNames(turn)).toContain('mcp__stamp__house_stamp')
  },
})
