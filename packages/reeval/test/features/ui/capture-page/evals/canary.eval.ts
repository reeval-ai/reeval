import { defineEval } from 'reeval'
import { noPageErrors } from 'reeval/graders'
import { ui } from './env.ts'

// The page throws and rejects a promise after it renders.
export default defineEval({
  environment: ui,
  graders: [noPageErrors('home')],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'home', path: '/sign-up' })
  },
})
