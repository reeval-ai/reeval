import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

// c.serve returns the port the server listens on, though it isn't PORT, and the tunnel reaches it.
export default defineEval({
  environment: ui,
  task: async (c) => {
    const app = await c.serve('node vite.mjs')
    await c.capture(app, { name: 'home' })
    const r = await c.exec(`node probe.mjs ${app.port}`)
    expect(r.stdout).toBe('vite')
  },
})
