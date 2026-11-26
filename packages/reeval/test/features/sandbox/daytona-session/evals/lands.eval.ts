import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, vm } from './env.ts'

// The agent runs as reeval in the workspace, on the login user's Node and its npm, behind the gateway.
export default defineEval({
  environment: vm,
  graders: [
    observed<string[]>(
      'agent-saw',
      (saw) =>
        JSON.stringify(saw.slice(0, 5)) ===
        JSON.stringify([
          'reeval',
          '/reeval/workspace',
          '/opt/reeval/node/bin/node',
          '/opt/reeval/node/bin/npm',
          'http://127.0.0.1:24128',
        ]),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('where am I')))
  },
})
