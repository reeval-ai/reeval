import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// The machine's first attempt finds it new and its second finds it reset, so either finds
// nothing left; the row's record check holds the one that ran second to it.
export default defineEval({
  environment: vm,
  graders: [
    observed<string[]>(
      'agent-saw',
      (saw) =>
        JSON.stringify(saw.slice(0, 3)) ===
        JSON.stringify(['home-clean', 'tmp-clean', 'proc-clean']),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('what did the last attempt leave?')))
  },
})
