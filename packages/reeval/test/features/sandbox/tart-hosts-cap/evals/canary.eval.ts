import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// Must fail: preflight skipped small, so no VM runs there.
export default defineEval({
  environment: mac,
  graders: [observed<string[]>('agent-saw', ([where = '']) => /\/hosts\/small\//.test(where))],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
