import { defineEval, expect } from 'reeval'

export default defineEval({
  async task(c) {
    await c.send('Write greet.js that greets in French.')
    await expect.require(c.exec('grep -q Bonjour greet.js'), 'french greeting').toSucceed()
    await expect(c.exec('grep -q Salut greet.js'), 'informal greeting').toSucceed()
  },
})
