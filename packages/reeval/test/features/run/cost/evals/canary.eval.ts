import { defineEval, expect } from 'reeval'
import { silent } from './agents.ts'

// Must fail: an agent that reports no tokens has nothing to price.
export default defineEval({
  agents: [silent],
  task: async (c) => {
    const turn = await c.send('say hi')
    expect(turn.usage).not.toBeNull()
  },
})
