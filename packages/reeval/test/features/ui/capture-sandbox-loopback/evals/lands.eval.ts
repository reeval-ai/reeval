import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { query, state, ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [observed('state', (value) => value === 'host,ip,name,refused,v6,ws')],
  task: async (c) => {
    await c.serve('node api.mjs', 9099)
    const server = await c.serve('node page.mjs')
    await c.capture(server, { name: 'loopback', path: query(9099), wait: 'load' })
    c.observe('state', (await c.exec(state)).stdout)
  },
})
