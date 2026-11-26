import { defineEval } from 'reeval'
import { agentPrinted, proxied } from './env.ts'

// Must fail: no policy refused the name, so the body doesn't say it did.
export default defineEval({
  environment: proxied,
  graders: [
    agentPrinted(
      'policy-refusal',
      ([body]) => body?.includes('blocked by the reeval egress policy') === true,
    ),
  ],
  task: async (c) => {
    await c.send('fetch a host that does not exist')
  },
})
