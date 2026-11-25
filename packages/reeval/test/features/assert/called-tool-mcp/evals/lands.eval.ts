import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const turn = await c.send('call house_stamp')
    expect(turn).toHaveCalledTool('mcp__stamp__house_stamp')
  },
})
