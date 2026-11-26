import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, mac } from './env.ts'

// The one host preflight kept.
export default defineEval({
  environment: mac,
  graders: [
    observed<string[]>('agent-saw', ([where = '']) =>
      /\/hosts\/mac-studio\/vms\/reeval-[^/]+\/home\//.test(where),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
