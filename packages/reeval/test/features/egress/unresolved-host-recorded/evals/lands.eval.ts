import { defineEval } from 'reeval'
import { agentPrinted, proxied } from './env.ts'

// A name that doesn't resolve gets the lookup's error, not a policy refusal.
export default defineEval({
  environment: proxied,
  graders: [
    agentPrinted('lookup-error', ([body]) =>
      /^reeval egress gateway can't resolve reeval-missing\.invalid: /.test(body?.trim() ?? ''),
    ),
  ],
  task: async (c) => {
    await c.send('fetch a host that does not exist')
  },
})
