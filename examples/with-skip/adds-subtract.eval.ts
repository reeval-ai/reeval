import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { math } from './environments.ts'

export default defineEval({
  environment: math,
  runs: 1,
  tags: ['math', 'smoke'],
  graders: [observed('subtract', (out) => out === '4')],
  async task(c) {
    await c.send('Add a subtract(a, b) function to src/math.js.')
    c.observe('subtract', (await c.exec('node ~/checks/call.mjs subtract 7 3')).stdout.trim())
  },
})
