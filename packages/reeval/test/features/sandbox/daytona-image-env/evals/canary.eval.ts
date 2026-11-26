import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, stock, TOOL } from './env.ts'

// Must fail: reeval's image without the Dockerfile has neither the tool nor the variable.
export default defineEval({
  environment: stock,
  graders: [
    observed<string[]>(
      'agent-saw',
      (saw) => JSON.stringify(saw.slice(0, 3)) === JSON.stringify([TOOL, TOOL, 'from-the-image']),
    ),
  ],
  task: async (c) => {
    c.observe('agent-saw', agentSaw(await c.send('find the tool')))
  },
})
