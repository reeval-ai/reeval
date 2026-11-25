import { defineEval, expect } from 'reeval'
import { agentSaw, open } from './env.ts'

// Must fail: under allow-all the direct connection reaches the listener.
export default defineEval({
  environment: open,
  task: async (c) => {
    const [, , direct] = agentSaw(await c.send('reach the listener'))
    expect(direct).toMatch(/^000 exit=[1-9]\d*$/)
  },
})
