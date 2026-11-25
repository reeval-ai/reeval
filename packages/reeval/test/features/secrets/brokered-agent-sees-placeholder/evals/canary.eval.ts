import { defineEval, expect } from 'reeval'
import { agentSaw, keys } from './env.ts'

// Must fail: the agent doesn't get the host value.
export default defineEval({
  environment: keys,
  task: async (c) => {
    const [key] = agentSaw(await c.send('print API_KEY'))
    expect(key).toBe(process.env.REEVAL_FIXTURE_TOKEN)
  },
})
