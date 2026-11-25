import { defineEval, expect } from 'reeval'
import { agentSaw, keys } from './env.ts'

// Must fail: the agent gets the value, not a placeholder.
export default defineEval({
  environment: keys,
  task: async (c) => {
    expect(agentSaw(await c.send('print API_KEY'))?.trim()).toMatch(/^reeval_secret_/)
  },
})
