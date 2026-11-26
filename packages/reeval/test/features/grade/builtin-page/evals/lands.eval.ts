import { defineEval } from 'reeval'
import { noPageErrors, pageStatus } from 'reeval/graders'
import { ui } from './env.ts'

// A capture's status and page errors, from what the capture recorded.
export default defineEval({
  environment: ui,
  graders: [
    pageStatus('home', 200, { required: true }),
    pageStatus('old', '4xx'),
    noPageErrors('home'),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'home' })
    await c.capture(server, { name: 'old', path: '/old' })
  },
})
