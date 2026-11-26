import assert from 'node:assert/strict'
import { defineEval } from 'reeval'

// Must fail: green isn't red, so that case fails the eval, and its case table marks it.
export default defineEval({
  cases: [{ key: 'red' }, { key: 'green' }],
  task: async (_c, { key: color }) => {
    assert.equal(color, 'red', 'is red')
  },
})
