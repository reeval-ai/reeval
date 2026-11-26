import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { unmasked, writable } from './env.ts'

// Must fail: the setup step runs `umask 0000` first, so out/ and out/log are world-writable.
export default defineEval({
  environment: unmasked,
  graders: [observed<string[]>('writable', (paths) => paths.length === 0)],
  task: async (c) => {
    await c.send('make things')
    c.observe('writable', await writable(c))
  },
})
