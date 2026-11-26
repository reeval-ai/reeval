import { defineEval } from 'reeval'
import { pageStatus } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  // The mistake: `/old` redirects to `/login`, which answers 404.
  graders: [pageStatus('old', 200, { required: true })],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'old', path: '/old' })
  },
})
