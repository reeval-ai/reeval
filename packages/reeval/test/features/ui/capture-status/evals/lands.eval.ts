import { defineEval } from 'reeval'
import { noPageErrors, observed, pageStatus } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [
    pageStatus('old', 404),
    pageStatus('old', '4xx', { name: 'page-status-4xx' }),
    observed('final-url', (url) => url === '/login'),
    noPageErrors('old'),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'old', path: '/old' })
    c.observe('final-url', shot.finalUrl)
  },
})
