import assert from 'node:assert/strict'
import { defineEval } from 'reeval'

// Must fail: its block names the failure.
export default defineEval({
  task: async (c) => {
    assert.equal(c.trial.n, 2, 'second try')
  },
})
