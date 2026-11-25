import { defineEval, expect } from 'reeval'
import { listed, reporter, unknown } from './agents.ts'

// A reported cost, an estimate at models.dev's list price, and no cost for an unlisted model.
export default defineEval({
  agents: [reporter, listed, unknown],
  task: async (c) => {
    const turn = await c.send('say hi')
    expect(turn.usage).not.toBeNull()
  },
})
