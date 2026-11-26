import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { LOG, prompt, stamp } from './env.ts'

// The agent reached the environment's stdio MCP server: the server logged the tool call.
export default defineEval({
  environment: stamp,
  graders: [succeeded('tool called')],
  task: async (c) => {
    await c.send(prompt)
    await c.exec(`grep -q tools/call ${LOG}`, { label: 'tool called' })
  },
})
