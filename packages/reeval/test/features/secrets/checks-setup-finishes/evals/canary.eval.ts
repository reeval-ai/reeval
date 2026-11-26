import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, finishes } from './env.ts'

// Must fail: no process the setup step started is still running.
export default defineEval({
  environment: finishes,
  graders: [observed('agent-saw', (saw) => saw === 'value')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('look for CHECK_TOKEN')) ?? null)
  },
})
