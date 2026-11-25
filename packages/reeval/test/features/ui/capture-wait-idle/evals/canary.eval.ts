import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const home = await c.capture(server, { name: 'home', wait: 'idle' })
    expect(home.file.path).toBe('artifacts/wrong.png')
  },
})
