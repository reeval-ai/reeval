import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { TOKEN } from './token.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const r = await c.exec('printf %s "$EXEC_TOKEN"', { env: { EXEC_TOKEN: TOKEN } })
    // Must fail, quoting the value, masked.
    expect(r.stdout).toBe('not the token')
  },
})
