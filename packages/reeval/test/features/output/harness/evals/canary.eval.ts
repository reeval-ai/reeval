import { defineEval, expect } from 'reeval'
import { idler, writer } from './agents.ts'

// Must fail: the idler writes nothing, so its row indents the failed check.
export default defineEval({
  agents: [writer, idler],
  task: async (c) => {
    await c.send('write out.txt')
    await expect(c, 'writes out.txt').toHaveFile('out.txt')
  },
})
