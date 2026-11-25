import { defineEval, expect } from 'reeval'
import { copier, writer } from './agents.ts'
import { marked, plain } from './env.ts'

// Must fail: the marker says ok, not nope, so every variant fails too.
export default defineEval({
  agents: [writer, copier],
  compare: { control: plain, variants: [marked] },
  task: async (c) => {
    await expect(c, 'has the marker').toHaveFile('marker.txt', /nope/)
  },
})
