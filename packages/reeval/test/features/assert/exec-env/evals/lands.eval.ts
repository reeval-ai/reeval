import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// `env` sets a variable for this command only.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const r = await c.exec('printf %s "$GREETING"', { env: { GREETING: 'hello' } })
    expect(r.stdout).toBe('hello')
  },
})
