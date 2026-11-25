import { defineEval, expect } from 'reeval'
import { query, state, ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    await c.serve('node api.mjs', 9099)
    const server = await c.serve('node page.mjs')
    await c.capture(server, { name: 'loopback', path: query(9099), wait: 'load' })
    expect((await c.exec(state)).stdout).toBe('host,ip,name,refused,v6,ws')
  },
})
