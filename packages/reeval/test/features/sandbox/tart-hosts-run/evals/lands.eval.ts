import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// The agent runs in a VM on one of the hosts: the fake keeps each Mac's VMs under hosts/<name>.
export default defineEval({
  environment: mac,
  graders: [
    observed<string[]>('agent-saw', ([where = '']) =>
      /\/hosts\/(mac-studio|mac-mini\.local)\/vms\/reeval-[^/]+\/home\//.test(where),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
