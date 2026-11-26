import { defineEval } from 'reeval'
import { agentPrinted, open } from './env.ts'

// Must fail: under allow-all the container keeps its network, and the connection reaches the listener.
export default defineEval({
  environment: open,
  graders: [
    agentPrinted('no-network', ([raw]) =>
      /Network is unreachable[\s\S]* exit=[1-9]\d*$/.test(raw?.trim() ?? ''),
    ),
  ],
  task: async (c) => {
    await c.send('connect over raw TCP')
  },
})
