import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defineEval, defineGrader } from 'reeval'
import { task } from '../lib/task.ts'

const answer = readFileSync(new URL('../data/answer.txt', import.meta.url), 'utf8').trim()

export default defineEval({
  // Set only where a test asks for a plan that differs from the bundle's.
  trials: process.env.BUNDLE_SECOND_EVAL ? 2 : 1,
  graders: [defineGrader('answers-42', { grade: () => answer === '42' })],
  async task(c) {
    const turn = await c.send(task)
    assert.equal(turn.text, 'hi')
  },
})
