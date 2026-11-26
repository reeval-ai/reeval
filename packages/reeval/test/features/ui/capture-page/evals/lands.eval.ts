import { defineEval } from 'reeval'
import { observed, pageStatus } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [
    pageStatus('home', 200),
    observed(
      'home',
      (shot) =>
        JSON.stringify(shot) ===
        JSON.stringify({
          finalUrl: '/sign-up',
          errors: ['Uncaught Error: late failure', 'Uncaught (in promise) Error: no session'],
          console: [
            { level: 'log', text: 'rendered', source: 'console-api', url: '/sign-up' },
            {
              level: 'warning',
              text: 'auth is not configured',
              source: 'console-api',
              url: '/sign-up',
            },
          ],
          failedRequests: [{ method: 'GET', url: '/missing.js', status: 404 }],
        }),
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'home', path: '/sign-up' })
    c.observe('home', {
      finalUrl: shot.finalUrl,
      errors: shot.errors.map((e) => e.split('\n')[0] ?? ''),
      console: shot.console.filter((m) => m.source === 'console-api'),
      failedRequests: shot.failedRequests,
    })
  },
})
