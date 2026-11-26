import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { left, server, vm } from './env.ts'

// c.serve finds the port the server listens on, and kill() leaves none of it running.
export default defineEval({
  environment: vm,
  graders: [
    observed<{ answer: string; left: string }>(
      'served',
      (served) => served.answer === 'ok' && served.left === '0',
    ),
  ],
  task: async (c) => {
    const app = await c.serve(server)
    const answer = (await c.exec(`curl -s http://127.0.0.1:${app.port}/`)).stdout
    await app.kill()
    c.observe('served', { answer, left: (await c.exec(left)).stdout.trim() })
  },
})
