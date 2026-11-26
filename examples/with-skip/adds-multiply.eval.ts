import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { math } from './environments.ts'

export default defineEval({
  environment: math,
  tags: ['math'],
  graders: [observed('multiply', (out) => out === '6')],
  async task(c) {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    c.observe('multiply', (await c.exec('node ~/checks/call.mjs multiply 2 3')).stdout.trim())
  },
})
