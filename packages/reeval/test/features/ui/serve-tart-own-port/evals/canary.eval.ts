import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

// Must fail: the server on the returned port is the one that ignores PORT.
export default defineEval({
  environment: ui,
  task: async (c) => {
    const app = await c.serve('node own-port.mjs')
    const r = await c.exec(`node probe.mjs ${app.port}`)
    expect(r.stdout).toBe('reads PORT')
  },
})
