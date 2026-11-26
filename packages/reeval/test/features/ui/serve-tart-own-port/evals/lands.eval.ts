import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ui } from './env.ts'

// c.serve finds the port the server listens on in the VM, though it isn't PORT.
export default defineEval({
  environment: ui,
  graders: [observed('probe', (value) => value === 'own port')],
  task: async (c) => {
    const app = await c.serve('node own-port.mjs')
    const r = await c.exec(`node probe.mjs ${app.port}`)
    c.observe('probe', r.stdout)
  },
})
