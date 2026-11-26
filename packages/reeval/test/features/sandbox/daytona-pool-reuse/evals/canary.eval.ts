import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// Must fail: the reset removed the home file the attempt before left, or there was none.
export default defineEval({
  environment: vm,
  graders: [observed<string[]>('agent-saw', ([home]) => home === 'home-dirty')],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('what did the last attempt leave?')))
  },
})
