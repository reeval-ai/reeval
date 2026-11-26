import { defineEval } from 'reeval'
import { noPageErrors } from 'reeval/graders'
import { ui } from './env.ts'

// The page handles its rejection later, so it has no page errors.
export default defineEval({
  environment: ui,
  graders: [
    // Scored the other way round: this canary needs the page errors noPageErrors counts.
    noPageErrors('loud', { name: 'has-page-errors', score: (errors) => (errors > 0 ? 1 : 0) }),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs')
    await c.capture(server, { name: 'loud', wait: { ms: 1000 }, timeout: '40s' })
  },
})
