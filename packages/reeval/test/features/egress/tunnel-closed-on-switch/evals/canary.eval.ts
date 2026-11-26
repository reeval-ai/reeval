import { defineEval } from 'reeval'
import { kept, tunnel, tunnelClosed } from './env.ts'

// Must fail: the agent's policy allows the listener's host, so its tunnel stays open.
export default defineEval({
  environment: kept,
  graders: [tunnelClosed],
  task: async (c) => {
    await c.exec(tunnel)
  },
})
