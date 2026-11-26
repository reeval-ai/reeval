import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// A secret with hosts reaches the agent as a placeholder; in Docker the gateway is its proxy.
export default defineEval({
  environment: keys,
  graders: [
    observed<{ key: string; hostValue: boolean; proxy: string | null }>(
      'agent-saw',
      ({ key, hostValue, proxy }) =>
        /^reeval_secret_[0-9A-Za-z]{32}$/.test(key) &&
        !hostValue &&
        (proxy === null || proxy === 'http://127.0.0.1:24128'),
    ),
  ],
  task: async (c) => {
    const [key = '', proxy = ''] = agentSaw(await c.send('print API_KEY'))
    const gateway = ['docker', 'podman'].includes(process.env.REEVAL_FIXTURE_SANDBOX ?? '')
    c.observe('agent-saw', {
      key,
      hostValue: key === process.env.REEVAL_FIXTURE_TOKEN,
      proxy: gateway ? proxy : null,
    })
  },
})
