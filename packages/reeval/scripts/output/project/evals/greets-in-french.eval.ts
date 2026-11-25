import { defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Results: a pass, a failed check with one that never ran after it, a check that fails one try
// of two, a throw no check explains, an infra error, and a skipped and a todo eval.

export default defineEval({
  task: async (c) => {
    await c.send('Write greet.js that greets in French.')
    await expect(c, 'writes greet.js').toHaveFile('greet.js')
    await expect.require(c.exec('grep -q Bonjour greet.js'), 'french greeting').toSucceed()
    await expect(c.exec('grep -q Salut greet.js'), 'informal greeting').toSucceed()
  },
})
