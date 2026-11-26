import { defineEval } from 'reeval'
import { pageStatus } from 'reeval/graders'
import { ui } from './env.ts'

// `/old` redirects to `/login`, which answers 404.
export default defineEval({
  environment: ui,
  graders: [pageStatus('old', 200)],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'old', path: '/old' })
  },
})
