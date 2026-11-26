import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { readWhenWritten, ui } from './env.ts'

// The server's output goes where the command redirects it, not to reeval's log.
export default defineEval({
  environment: ui,
  graders: [
    observed<{ port: number; line: string }>(
      'served.log',
      ({ port, line }) => line === `listening on ${port}`,
    ),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs > served.log')
    const r = await c.exec(readWhenWritten('served.log'))
    c.observe('served.log', { port: server.port, line: r.stdout.trim() })
  },
})
