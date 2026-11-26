import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Must fail: the server on the returned port is the one that ignores PORT.
export default defineEval({
  environment: ui,
  graders: [observed('probe', (value) => value === 'reads PORT')],
  task: async (c) => {
    const app = await c.serve('node own-port.mjs')
    const r = await c.exec(`node probe.mjs ${app.port}`)
    c.observe('probe', r.stdout)
  },
})
