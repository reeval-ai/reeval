import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// Must fail: no VM runs on this machine's Tart, whose VMs sit straight under vms/.
export default defineEval({
  environment: mac,
  graders: [
    observed<string[]>('agent-saw', ([where = '']) => /reeval-fake-tart-[^/]+\/vms\//.test(where)),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
