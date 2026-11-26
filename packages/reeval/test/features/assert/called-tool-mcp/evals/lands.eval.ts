import { defineEval } from 'reeval'
import { calledTool } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [calledTool('mcp__stamp__house_stamp')],
  task: async (c) => {
    await c.send('call house_stamp')
  },
})
