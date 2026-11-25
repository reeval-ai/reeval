import { defineEval, expect } from 'reeval'
import { agentSaw, tokens } from './env.ts'

// Must fail: the agent doesn't see what the checks see.
export default defineEval({
  environment: tokens,
  task: async (c) => {
    const turn = await c.send('print CHECK_TOKEN')
    const checksSee = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    expect(agentSaw(turn)).toBe(`${checksSee}\n`)
  },
})
