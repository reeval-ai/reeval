import { defineEval, expect } from 'reeval'
import { agentSaw, vm } from './env.ts'

// The agent runs as reeval in the workspace, in a container of reeval's image, behind the gateway.
export default defineEval({
  environment: vm,
  task: async (c) => {
    expect(agentSaw(await c.send('where am I')).slice(0, 4)).toEqual([
      'reeval',
      '/reeval/workspace',
      '/usr/local/bin/node',
      'http://127.0.0.1:24128',
    ])
  },
})
