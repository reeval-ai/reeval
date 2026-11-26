import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// Must fail: the attempt didn't install the agent itself.
export default defineEval({
  environment: mac,
  graders: [observed<string[]>('agent-saw', ([where]) => where === 'here')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where was I installed')))
  },
})
