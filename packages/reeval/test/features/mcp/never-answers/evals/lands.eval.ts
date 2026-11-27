import { defineEval } from 'reeval'
import { prompt, silent } from './env.ts'

// A server that doesn't answer initialize within 60s fails the trial as an infra error naming
// it (features.test.ts checks the message), instead of holding the turn: c.send throws.
export default defineEval({
  environment: silent,
  task: async (c) => {
    await c.send(prompt)
    throw new Error('the eval body ran on after an MCP server timed out')
  },
})
