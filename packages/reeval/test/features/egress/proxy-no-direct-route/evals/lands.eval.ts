import { defineEval } from 'reeval'
import { agentPrinted, proxied } from './env.ts'

// Under the default policy the container has no network of its own: a raw TCP connection, which
// no proxy routes through the gateway, has nowhere to go.
export default defineEval({
  environment: proxied,
  graders: [
    agentPrinted('no-network', ([raw]) =>
      /Network is unreachable[\s\S]* exit=[1-9]\d*$/.test(raw?.trim() ?? ''),
    ),
  ],
  task: async (c) => {
    await c.send('connect over raw TCP')
  },
})
