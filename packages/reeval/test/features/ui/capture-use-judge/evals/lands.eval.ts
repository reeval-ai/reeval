import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'journey', instructions: ['Open the menu'] })
    expect(shot.file.path).toBe('artifacts/journey.png')
  },
})
