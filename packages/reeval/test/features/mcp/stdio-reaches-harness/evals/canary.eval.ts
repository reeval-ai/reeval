import { defineEval, expect } from 'reeval'
import { LOG, stamp } from './env.ts'

// Must fail: with no turn, nothing has called the tool.
export default defineEval({
  environment: stamp,
  task: async (c) => {
    expect((await c.readFile(LOG)) ?? '').toContain('tools/call')
  },
})
