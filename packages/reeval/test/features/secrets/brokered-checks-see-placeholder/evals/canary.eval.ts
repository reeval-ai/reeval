import { defineEval, expect } from 'reeval'
import { keys } from './env.ts'

// Must fail: the checks don't get the host value either.
export default defineEval({
  environment: keys,
  task: async (c) => {
    const seen = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    expect(seen).toBe(process.env.REEVAL_FIXTURE_TOKEN)
  },
})
