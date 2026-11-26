import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { hidden } from './env.ts'

// A trait is for where: its value is in no workspace file, variable or prompt.
export default defineEval({
  environment: hidden,
  graders: [observed('trait-found', (found) => found === '0')],
  task: async (c) => {
    await c.send('Look around.')
    const found = await c.exec('grep -rl trait-zx81 . ; env | grep -c trait-zx81 || true')
    c.observe('trait-found', found.stdout.trim())
  },
})
