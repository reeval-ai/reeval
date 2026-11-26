import { defineEval } from 'reeval'
import { calledTool } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent called house_stamp, not other.
  graders: [calledTool('mcp__stamp__other')],
  task: async (c) => {
    await c.send('call house_stamp')
  },
})
