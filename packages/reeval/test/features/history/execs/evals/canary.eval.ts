import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { runExecs } from './execs.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const after = await runExecs(c)
    // The mistake: the build went to stdout, not stderr.
    expect(after.stderr, 'reads the build').toMatch(/^built\n/)
  },
})
