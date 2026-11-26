import { defineEval } from 'reeval'
import { agentPrinted, phased } from './env.ts'

// The setup steps finish under the setup policy before the agent's turn starts under its own.
export default defineEval({
  environment: phased,
  graders: [agentPrinted('reads-ready', ([read]) => read?.trim() === 'ready')],
  task: async (c) => {
    await c.send('read ready.txt')
  },
})
