import { defineEval, expect } from 'reeval'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'home', path: '/sign-up' })
    // The page throws and rejects a promise after it renders.
    expect(shot).toHaveNoPageErrors()
  },
})
