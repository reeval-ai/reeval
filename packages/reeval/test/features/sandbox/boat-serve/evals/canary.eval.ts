import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { left, server, vm } from './env.ts'

// Must fail: the server is still running before kill().
export default defineEval({
  environment: vm,
  graders: [observed('left', (left) => left === '0')],
  task: async (c) => {
    const app = await c.serve(server)
    c.observe('left', (await c.exec(left)).stdout.trim())
    await app.kill()
  },
})
