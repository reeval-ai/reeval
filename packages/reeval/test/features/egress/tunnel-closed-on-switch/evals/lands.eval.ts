import { defineEval, expect } from 'reeval'
import { closed, tunnel } from './env.ts'

// A tunnel setup opened stays open only while the policy allows its host: the switch to the
// agent's deny-all closes it.
export default defineEval({
  environment: closed,
  task: async (c) => {
    expect((await c.exec(tunnel)).stdout.trim()).toBe('closed')
  },
})
