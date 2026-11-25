import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

// A server on PORT gets PORT, though a side port opened first.
export default defineEval({
  environment: ui,
  task: async (c) => {
    const app = await c.serve('node server.mjs')
    const r = await c.exec(`node probe.mjs ${app.port}`)
    expect(r.stdout).toBe('main')
  },
})
