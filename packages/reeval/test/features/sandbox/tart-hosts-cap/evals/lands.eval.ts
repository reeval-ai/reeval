import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// The one host preflight kept.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [where] = agentSaw(await c.send('where am I'))
    expect(where).toMatch(/\/hosts\/mac-studio\/vms\/reeval-[^/]+\/home\//)
  },
})
