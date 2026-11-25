import { defineEval, expect } from 'reeval'
import { math } from './environments.ts'

export default defineEval({
  environment: math,
  runs: 1,
  tags: ['math', 'smoke'],
  async task(c) {
    await c.send('Add a subtract(a, b) function to src/math.js.')
    expect((await c.exec('node ~/checks/call.mjs subtract 7 3')).stdout.trim()).toBe('4')
  },
})
