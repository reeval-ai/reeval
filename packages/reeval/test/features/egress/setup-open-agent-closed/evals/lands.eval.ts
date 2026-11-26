import { defineEval } from 'reeval'
import { direct, phased, phases } from './env.ts'

// Setup runs under allow-all and reaches the listener directly; the agent's turn and the check
// after it run under deny-all, where the only route out is the gateway.
export default defineEval({
  environment: phased,
  graders: [phases],
  task: async (c) => {
    await c.send('reach the listener')
    await c.exec(direct)
  },
})
