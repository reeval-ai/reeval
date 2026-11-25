import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { runExecs } from './execs.ts'

// The record keeps each c.exec in order, with its label, output and the turn it came after.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const after = await runExecs(c)
    expect(after.stdout, 'reads the build').toMatch(/^built\n/)
  },
})
