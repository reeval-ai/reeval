import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { observeLog } from './observe.ts'

// An observation of any size is kept whole, with the sha256 of its masked JSON.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const log = await observeLog(c)
    expect(log.split('\n'), 'logs every step').toHaveLength(4001)
  },
})
