import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// Must fail: the attempt didn't install the agent itself.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [where] = agentSaw(await c.send('where was I installed'))
    expect(where).toBe('here')
  },
})
