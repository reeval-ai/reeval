import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    try {
      await c.capture(server, { name: 'menu', instructions: ['Open the menu'] })
    } catch (error) {
      // Lands fails on the stuck instruction; this expects another wording.
      expect((error as Error).message).toBe('still open')
    }
  },
})
