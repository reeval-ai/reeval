import { defineEval, expect } from 'reeval'

export default defineEval({
  async task(c) {
    await c.send('Write greet.js that greets in German.')
    await expect(c.exec('grep -q Hallo greet.js'), 'german greeting').toSucceed()
  },
})
