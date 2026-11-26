import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// kill() stops what a compound command started, not only the shell that waits on it.
export default defineEval({
  environment: ui,
  graders: [observed('probe', (value) => value === 'down')],
  task: async (c) => {
    const server = await c.serve('node server.mjs || echo crashed')
    await c.exec(`node probe.mjs ${server.port} up`)
    await server.kill()
    const r = await c.exec(`node probe.mjs ${server.port} down`)
    c.observe('probe', r.stdout)
  },
})
