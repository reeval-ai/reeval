import { defineEval, expect } from 'reeval'
import { agentSaw, open } from './env.ts'

// Must fail: under allow-all the container keeps its network, and the connection reaches the listener.
export default defineEval({
  environment: open,
  task: async (c) => {
    const [raw] = agentSaw(await c.send('connect over raw TCP'))
    expect(raw?.trim()).toMatch(/Network is unreachable[\s\S]* exit=[1-9]\d*$/)
  },
})
