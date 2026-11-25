import { defineEval, expect } from 'reeval'
import { agentSaw, phased } from './env.ts'

// The setup steps finish under the setup policy before the agent's turn starts under its own.
export default defineEval({
  environment: phased,
  task: async (c) => {
    const [read] = agentSaw(await c.send('read ready.txt'))
    expect(read?.trim()).toBe('ready')
  },
})
