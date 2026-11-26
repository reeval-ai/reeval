import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain, readWhenWritten } from './env.ts'

// Must fail: the file holds `started`, not `stopped`.
export default defineEval({
  environment: plain,
  graders: [observed('bg.txt', (value) => value === 'stopped')],
  task: async (c) => {
    await c.exec('sleep 1 && echo started > bg.txt', { background: true })
    const r = await c.exec(readWhenWritten('bg.txt'))
    c.observe('bg.txt', r.stdout.trim())
  },
})
