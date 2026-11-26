import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, finishes } from './env.ts'

// A setup step that finishes leaves no process holding the `to: 'checks'` secret, so nothing is
// recorded (checked from outside).
export default defineEval({
  environment: finishes,
  graders: [observed('agent-saw', (saw) => saw === '')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('look for CHECK_TOKEN')) ?? null)
  },
})
