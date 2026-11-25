import { defineEval, expect } from 'reeval'
import { seeded } from './env.ts'

export default defineEval({
  environment: seeded,
  task: async (c) => {
    await c.send('update the greet test')
    // The agent's shell command did change the test.
    expect(c).not.toHaveChanged('test/**')
  },
})
