import { defineEval, expect } from 'reeval'
import { agentSaw, finishes } from './env.ts'

// Must fail: no process the setup step started is still running.
export default defineEval({
  environment: finishes,
  task: async (c) => {
    expect(agentSaw(await c.send('look for CHECK_TOKEN'))).toBe('value')
  },
})
