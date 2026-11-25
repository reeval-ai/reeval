import { defineEval, expect } from 'reeval'
import { math } from './environments.ts'

export default defineEval({
  environment: math,
  tags: ['math'],
  skip: "divide by zero isn't specified yet",
  async task(c) {
    await c.send('Add a divide(a, b) function to src/math.js.')
    expect((await c.exec('node ~/checks/call.mjs divide 8 2')).stdout.trim()).toBe('4')
  },
})
