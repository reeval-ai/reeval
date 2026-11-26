import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// A server on PORT gets PORT, though a side port opened first.
export default defineEval({
  environment: ui,
  graders: [observed('probe', (value) => value === 'main')],
  task: async (c) => {
    const app = await c.serve('node server.mjs')
    const r = await c.exec(`node probe.mjs ${app.port}`)
    c.observe('probe', r.stdout)
  },
})
