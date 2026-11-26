import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { leaked } from './env.ts'

// Must fail: its environment writes the trait's value to a file, which the grep finds.
export default defineEval({
  environment: leaked,
  graders: [observed('trait-found', (found) => found === '0')],
  task: async (c) => {
    await c.send('Look around.')
    const found = await c.exec('grep -rl trait-zx81 . ; env | grep -c trait-zx81 || true')
    c.observe('trait-found', found.stdout.trim())
  },
})
