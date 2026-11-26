import { defineEval } from 'reeval'
import { closed, tunnel, tunnelClosed } from './env.ts'

// A tunnel setup opened stays open only while the policy allows its host: the switch to the
// agent's deny-all closes it.
export default defineEval({
  environment: closed,
  graders: [tunnelClosed],
  task: async (c) => {
    await c.exec(tunnel)
  },
})
