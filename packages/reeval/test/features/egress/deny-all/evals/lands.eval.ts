import { defineEval } from 'reeval'
import { agentPrinted, closed } from './env.ts'

// Under deny-all the sandbox has no route out but the gateway: a direct connection fails, and
// nothing resolves a name for it, neither its own resolver nor a DNS server on the host.
export default defineEval({
  environment: closed,
  graders: [
    agentPrinted('no-route-out', ([direct, dns]) =>
      /^000 exit=[1-9]\d* dns=[1-9]\d*$/.test(`${direct?.trim()} ${dns?.trim()}`),
    ),
  ],
  task: async (c) => {
    await c.send('reach the listener')
  },
})
