import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// The agent holds a placeholder for its harness's key, and goes out through the gateway.
export default defineEval({
  environment: mac,
  graders: [
    observed<string[]>(
      'agent-saw',
      ([key = '', proxy]) => /^reeval_fake_/.test(key) && proxy === 'http://127.0.0.1:24128',
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('which key do I have')))
  },
})
