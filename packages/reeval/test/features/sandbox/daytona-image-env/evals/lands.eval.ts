import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, image, TOOL } from './env.ts'

// The image's ENV reaches the agent's commands over SSH, its PATH in login shells too.
export default defineEval({
  environment: image,
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
