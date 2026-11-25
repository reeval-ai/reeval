import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// A soft check that fails, then a judge that fails, in one attempt.

export default defineEval({
  skip: true,
  task: async (c) => {
    await c.send('Write nothing.')
  },
})
