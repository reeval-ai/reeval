import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineEval({
  task: async (c) => {
    const turn = await c.send('Write greet.js exporting greet(name).')
    await expect.require(turn).toHaveFile('greet.js', /Hello/)
    expect(await c.judge('Does greet.js export greet?', { diff: true })).toPass()
  },
})

// A soft check that fails, then a judge that fails, in one attempt.
