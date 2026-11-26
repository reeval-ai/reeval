import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { math } from './environments.ts'

export default defineEval({
  environment: math,
  tags: ['math'],
  skip: "divide by zero isn't specified yet",
  graders: [observed('divide', (out) => out === '4')],
  async task(c) {
    await c.send('Add a divide(a, b) function to src/math.js.')
    c.observe('divide', (await c.exec('node ~/checks/call.mjs divide 8 2')).stdout.trim())
  },
})
