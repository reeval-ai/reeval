import { defineEval, expect } from 'reeval'
import { copier, writer } from './agents.ts'

// Compare agents: a row per harness with its `N of M`.
export default defineEval({
  agents: [writer, copier],
  task: async (c) => {
    await c.send('write out.txt')
    await expect(c, 'writes out.txt').toHaveFile('out.txt')
  },
})
