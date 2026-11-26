import { defineEval } from 'reeval'
import { agentPrinted, phased } from './env.ts'

// Must fail: the agent finds the setup step's file, so it didn't start before setup finished.
export default defineEval({
  environment: phased,
  graders: [agentPrinted('reads-nothing', ([read]) => read?.trim() === '')],
  task: async (c) => {
    await c.send('read ready.txt')
  },
})
