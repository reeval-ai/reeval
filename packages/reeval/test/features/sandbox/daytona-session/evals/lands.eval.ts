import { defineEval, expect } from 'reeval'
import { agentSaw, vm } from './env.ts'

// The agent runs as reeval in the workspace, on the login user's Node and its npm, behind the gateway.
export default defineEval({
  environment: vm,
  task: async (c) => {
    expect(agentSaw(await c.send('where am I')).slice(0, 5)).toEqual([
      'reeval',
      '/reeval/workspace',
      '/opt/reeval/node/bin/node',
      '/opt/reeval/node/bin/npm',
      'http://127.0.0.1:24128',
    ])
  },
})
