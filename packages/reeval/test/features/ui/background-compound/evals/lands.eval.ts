import { defineEval, expect } from 'reeval'
import { plain, readWhenWritten } from './env.ts'

// The command's own redirect writes the file: the log redirect wraps the whole command.
export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.exec('sleep 1 && echo started > bg.txt', { background: true })
    const r = await c.exec(readWhenWritten('bg.txt'))
    expect(r.stdout.trim()).toBe('started')
  },
})
