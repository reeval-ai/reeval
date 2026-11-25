import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// Must fail: no VM runs on this machine's Tart, whose VMs sit straight under vms/.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [where] = agentSaw(await c.send('where am I'))
    expect(where).toMatch(/reeval-fake-tart-[^/]+\/vms\//)
  },
})
