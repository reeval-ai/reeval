import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// Each slot is a container of its own on the machine, with the layout a machine of its own has.
export default defineEval({
  environment: vm,
  graders: [
    observed<string[]>(
      'agent-saw',
      (saw) =>
        JSON.stringify(saw.slice(0, 4)) ===
        JSON.stringify(['reeval', '/reeval/workspace', '/home/reeval', 'http://127.0.0.1:24128']),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
