import { defineEval, expect } from 'reeval'
import { kept, tunnel } from './env.ts'

// Must fail: the agent's policy allows the listener's host, so its tunnel stays open.
export default defineEval({
  environment: kept,
  task: async (c) => {
    expect((await c.exec(tunnel)).stdout.trim()).toBe('closed')
  },
})
