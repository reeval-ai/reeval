import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Results: a pass, a failed check with one that never ran after it, a check that fails one try
// of two, a throw no check explains, an infra error, and a skipped and a todo eval.

export default defineEval({
  task: async (c) => {
    await c.send('Read the fixture repo.')
    throw new Error('the fixture repo is missing')
  },
})
