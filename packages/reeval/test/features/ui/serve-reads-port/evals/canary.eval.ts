import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// Must fail: the returned port is PORT's server, not the side port that opened first.
export default defineEval({
  environment: ui,
  graders: [observed('probe', (value) => value === 'side')],
  task: async (c) => {
    const app = await c.serve('node server.mjs')
    const r = await c.exec(`node probe.mjs ${app.port}`)
    c.observe('probe', r.stdout)
  },
})
