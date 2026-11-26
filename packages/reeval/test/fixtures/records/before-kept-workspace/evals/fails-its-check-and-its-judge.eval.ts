import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// A soft check that fails, then a judge that fails, in one attempt.
export default defineEval({
  task: async (c) => {
    await c.send('Write greet.js that greets in French.')
    await expect(c.exec('grep -q Bonjour greet.js')).toSucceed()
    expect(await c.judge('Is greet.js perfect?', { threshold: 0.95, diff: true })).toPass()
  },
})
