import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { readWhenWritten, ui } from './env.ts'

// Must fail: the server listens on its own port, not port 1.
export default defineEval({
  environment: ui,
  graders: [
    observed<{ port: number; line: string }>('served.log', ({ line }) => line === 'listening on 1'),
  ],
  task: async (c) => {
    const server = await c.serve('node server.mjs > served.log')
    const r = await c.exec(readWhenWritten('served.log'))
    c.observe('served.log', { port: server.port, line: r.stdout.trim() })
  },
})
