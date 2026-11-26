import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { TOKEN } from './token.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const r = await c.exec('printf %s "$EXEC_TOKEN"', { env: { EXEC_TOKEN: TOKEN } })
    // Must fail, quoting the value, masked.
    assert.equal(r.stdout, 'not the token')
  },
})
