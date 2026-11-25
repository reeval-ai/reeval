import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

// Must fail: a command that exits never serves.
export default defineEval({
  environment: ui,
  task: async (c) => {
    try {
      await c.serve('node server.mjs')
    } catch (error) {
      expect((error as Error).message).toBe('served')
    }
  },
})
