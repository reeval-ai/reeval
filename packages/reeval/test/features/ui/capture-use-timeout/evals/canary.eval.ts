import { defineEval, expect } from 'reeval'
import { fakeInstructions } from 'reeval/testing'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  capture: { timeout: '10s' },
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    try {
      await c.capture(server, {
        name: 'late',
        instructions: fakeInstructions([[{ type: 'click', x: 1, y: 1 }]]),
      })
    } catch (error) {
      // Lands fails on the unfinished instruction; this expects another wording.
      expect((error as Error).message).toBe('still loading')
    }
  },
})
