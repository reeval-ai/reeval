import { defineEval, expect } from 'reeval'

export default defineEval({
  async task(c) {
    await c.send('Write greet.js that greets in our house style.')
    await expect(c, 'writes greet.js').toHaveFile('greet.js')
    await expect
      .require(
        c.exec(`grep -q ${process.env.REEVAL_COMPARE_SIDE === 'head' ? 'Ahoy' : 'Hello'} greet.js`),
        'house greeting',
      )
      .toSucceed()
    await expect(c.exec('grep -q "!" greet.js'), 'sign-off').toSucceed()
  },
})
