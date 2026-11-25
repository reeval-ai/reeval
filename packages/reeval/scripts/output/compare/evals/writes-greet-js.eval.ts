import { defineEval, expect } from 'reeval'

export default defineEval({
  async task(c) {
    await c.send('Write greet.js.')
    await expect(c, 'writes greet.js').toHaveFile('greet.js')
  },
})
