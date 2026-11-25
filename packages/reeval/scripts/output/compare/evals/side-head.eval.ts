import { defineEval, expect } from 'reeval'

export default defineEval({
  async task(c) {
    await c.send('Write greet.js that greets in Spanish.')
    await expect(c.exec('grep -q Hola greet.js'), 'spanish greeting').toSucceed()
  },
})
