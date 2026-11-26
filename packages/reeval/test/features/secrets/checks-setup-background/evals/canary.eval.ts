import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, brokered } from './env.ts'

// Must fail: brokered with hosts, setup's process holds only a placeholder.
export default defineEval({
  environment: brokered,
  graders: [observed('agent-saw', (saw) => saw === 'value')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('look for CHECK_TOKEN')) ?? null)
  },
})
