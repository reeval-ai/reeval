import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    // The mistake: the variable is set under another name, so the command reads none.
    const r = await c.exec('printf %s "$GREETING"', { env: { GREETNG: 'hello' } })
    expect(r.stdout).toBe('hello')
  },
})
