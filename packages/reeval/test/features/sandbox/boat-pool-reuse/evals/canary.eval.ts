import { defineEval, expect } from 'reeval'
import { agentSaw, vm } from './env.ts'

// Must fail: the reset removed the home file the attempt before left, or there was none.
export default defineEval({
  environment: vm,
  task: async (c) => {
    const [home] = agentSaw(await c.send('what did the last attempt leave?'))
    expect(home).toBe('home-dirty')
  },
})
