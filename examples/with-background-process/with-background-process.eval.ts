import { defineEnvironment, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'

// The agent's commands and the task's both see PORT.
const app = defineEnvironment('server', ({ directory }) => ({
  files: directory('./project'),
  env: { PORT: '4100' },
}))

// curl retries until the server is listening.
const health = 'curl -sf --retry 10 --retry-connrefused --retry-delay 1 "localhost:$PORT/health"'

export default defineEval({
  environment: app,
  // The server lives only while the task runs, so the task records what it answered and the
  // graders read that.
  graders: [succeeded('health'), observed('health', (body) => body === 'ok')],
  task: async (c) => {
    await c.send('Add a GET /health route to server.js that responds 200 with "ok".')

    const server = await c.exec('node server.js', { background: true })
    const res = await c.exec(health, { label: 'health' })
    server.kill()
    c.observe('health', res.stdout.trim())
  },
})
