import { defineEval, expect } from 'reeval'
import { plain, signature } from './env.ts'

// Must fail: before a turn no runner holds the key, so there's nothing to exchange.
export default defineEval({
  environment: plain,
  task: async (c) => {
    expect(await signature(c.exec)).toMatch(/^reeval_secret_/)
  },
})
