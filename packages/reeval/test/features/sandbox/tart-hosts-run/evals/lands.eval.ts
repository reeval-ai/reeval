import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// The agent runs in a VM on one of the hosts: the fake keeps each Mac's VMs under hosts/<name>.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [where] = agentSaw(await c.send('where am I'))
    expect(where).toMatch(/\/hosts\/(mac-studio|mac-mini\.local)\/vms\/reeval-[^/]+\/home\//)
  },
})
