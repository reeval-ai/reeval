import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { observeLog } from './observe.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    const log = await observeLog(c)
    // The mistake: the build logged 4000 steps, not 4.
    expect(log.split('\n'), 'logs every step').toHaveLength(5)
  },
})
