import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// Must fail: the agent isn't the VM's login user.
export default defineEval({
  environment: vm,
  graders: [observed<string[]>('agent-saw', ([user]) => user === 'user')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
