import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'tall', viewport: 'full-page' })
    // Window size instead of the author key.
    expect(shot.viewport).toEqual({ width: 1280, height: 720 })
  },
})
