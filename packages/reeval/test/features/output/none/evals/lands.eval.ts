import assert from 'node:assert/strict'
import { defineEval } from 'reeval'

// One cell that passes prints its verdict and name, nothing under it.
export default defineEval({
  task: async (c) => {
    assert.equal(c.trial.n, 1, 'first try')
  },
})
