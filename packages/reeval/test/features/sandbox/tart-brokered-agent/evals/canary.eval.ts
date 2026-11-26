import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// Must fail: the agent never holds the host's key.
export default defineEval({
  environment: mac,
  graders: [observed<string[]>('agent-saw', ([key]) => key === 'key_tart_fixture')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('which key do I have')))
  },
})
