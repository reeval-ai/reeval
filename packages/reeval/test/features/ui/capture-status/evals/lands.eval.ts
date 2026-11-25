import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'old', path: '/old' })
    expect(shot).toHaveStatus(404)
    expect(shot).toHaveStatus('4xx')
    expect(shot.finalUrl).toBe('/login')
    expect(shot).toHaveNoPageErrors()
  },
})
