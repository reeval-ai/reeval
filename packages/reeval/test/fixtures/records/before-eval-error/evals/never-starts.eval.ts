import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// A soft check that fails, then a judge that fails, in one attempt.

export default defineEval({
  agents: fakeAgent({ id: 'broken', failWith: 'the fake sandbox fell over' }),
  task: async (c) => {
    await c.send('Write greet.js.')
  },
})
