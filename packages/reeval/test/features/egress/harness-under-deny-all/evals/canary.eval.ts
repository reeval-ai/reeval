import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { closed, reach } from './env.ts'

// Must fail: any other host is refused at CONNECT, with no turn needed.
export default defineEval({
  environment: closed,
  graders: [observed<string | null>('reached.txt', (text) => /^200 \d{3}$/.test(text ?? ''))],
  task: async (c) => {
    await c.exec(reach('registry.npmjs.org'))
    c.observe('reached.txt', await c.readFile('reached.txt'))
  },
})
