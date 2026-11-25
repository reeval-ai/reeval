import { defineEval, expect } from 'reeval'
import { math } from './environments.ts'

export default defineEval({
  environment: math,
  tags: ['math'],
  async task(c) {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    expect((await c.exec('node ~/checks/call.mjs multiply 2 3')).stdout.trim()).toBe('6')
  },
})
