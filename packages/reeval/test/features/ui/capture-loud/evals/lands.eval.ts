import { defineEval } from 'reeval'
import { noPageErrors, observed, pageStatus } from 'reeval/graders'
import { ui } from './env.ts'

export default defineEval({
  environment: ui,
  graders: [
    pageStatus('loud', 200),
    noPageErrors('loud'),
    observed<{ console: number; dropped: number }>(
      'loud',
      (shot) => shot.console === 100 && shot.dropped === 1201,
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    const shot = await c.capture(server, { name: 'loud', wait: { ms: 1000 }, timeout: '40s' })
    c.observe('loud', { console: shot.console.length, dropped: shot.dropped })
  },
})
