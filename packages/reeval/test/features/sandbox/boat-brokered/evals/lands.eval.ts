import { defineEval, expect } from 'reeval'
import { agentSaw, keys } from './env.ts'

// A secret with hosts reaches the agent on the VM as a placeholder; the value stays on the host.
export default defineEval({
  environment: keys,
  task: async (c) => {
    const [key] = agentSaw(await c.send('print API_KEY'))
    expect(key).toMatch(/^reeval_secret_[0-9A-Za-z]{32}$/)
  },
})
