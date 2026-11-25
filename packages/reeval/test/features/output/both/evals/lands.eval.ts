import { defineEval, expect } from 'reeval'
import { copier, writer } from './agents.ts'
import { marked, plain } from './env.ts'

// Both: the harness outer, its arms inner.
export default defineEval({
  agents: [writer, copier],
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt')
  },
})
