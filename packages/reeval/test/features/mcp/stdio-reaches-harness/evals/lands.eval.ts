import { defineEval, expect } from 'reeval'
import { LOG, prompt, stamp } from './env.ts'

// The agent reached the environment's stdio MCP server: the server logged the tool call.
export default defineEval({
  environment: stamp,
  task: async (c) => {
    await c.send(prompt)
    expect((await c.readFile(LOG)) ?? '').toContain('tools/call')
  },
})
