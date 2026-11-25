import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    // The mistake: the build exits 1, and the check fails the attempt without `await`.
    expect(await c.exec('echo broken >&2; exit 1'), 'builds').toSucceed()
  },
})
