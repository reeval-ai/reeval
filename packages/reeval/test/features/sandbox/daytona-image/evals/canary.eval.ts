import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// Must fail: the sandbox logs in as root, but the agent isn't root.
export default defineEval({
  environment: vm,
  graders: [observed<string[]>('agent-saw', ([user]) => user === 'root')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('what is here')))
  },
})
