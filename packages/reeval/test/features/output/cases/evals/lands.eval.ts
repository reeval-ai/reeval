import assert from 'node:assert/strict'
import { defineEval } from 'reeval'

// An eval with cases is one row; every case passed, so it prints on one line.
export default defineEval({
  cases: [{ key: 'red' }, { key: 'blue' }],
  task: async (_c, { key: color }) => {
    assert.ok(color.length > 0, 'named')
  },
})
