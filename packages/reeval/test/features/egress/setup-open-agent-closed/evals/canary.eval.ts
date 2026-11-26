import { defineEval } from 'reeval'
import { direct, open, phases } from './env.ts'

// Must fail: under one allow-all policy the agent and the check reach the listener too.
export default defineEval({
  environment: open,
  graders: [phases],
  task: async (c) => {
    await c.send('reach the listener')
    await c.exec(direct)
  },
})
