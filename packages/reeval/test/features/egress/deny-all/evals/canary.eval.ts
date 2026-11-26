import { defineEval } from 'reeval'
import { agentPrinted, open } from './env.ts'

// Must fail: under allow-all the same direct connection reaches the listener.
export default defineEval({
  environment: open,
  graders: [
    agentPrinted('no-route-out', ([direct, dns]) =>
      /^000 exit=[1-9]\d* dns=[1-9]\d*$/.test(`${direct?.trim()} ${dns?.trim()}`),
    ),
  ],
  task: async (c) => {
    await c.send('reach the listener')
  },
})
