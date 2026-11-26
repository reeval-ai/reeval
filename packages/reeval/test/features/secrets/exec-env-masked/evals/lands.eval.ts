import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { TOKEN } from './token.ts'

// The command prints a secret-named value it was given; the oracle finds it nowhere reeval wrote.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const r = await c.exec('printf %s "$EXEC_TOKEN"', { env: { EXEC_TOKEN: TOKEN } })
    console.log(r.stdout)
    assert.equal(r.stdout, TOKEN)
  },
})
