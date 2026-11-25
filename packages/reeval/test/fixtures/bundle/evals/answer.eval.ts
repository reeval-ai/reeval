import { readFileSync } from 'node:fs'
import { defineEval, expect } from 'reeval'
import { task } from '../lib/task.ts'

const answer = readFileSync(new URL('../data/answer.txt', import.meta.url), 'utf8').trim()

export default defineEval({
  // Set only where a test asks for a plan that differs from the bundle's.
  runs: process.env.BUNDLE_SECOND_EVAL ? 2 : 1,
  async task(c) {
    const turn = await c.send(task)
    expect(turn.text).toBe('hi')
    expect(answer).toBe('42')
  },
})
