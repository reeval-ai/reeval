import { defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

export default defineEval({
  graders: [
    hasFile('greet.js', { name: 'writes greet.js' }),
    succeeded('house greeting', { required: true }),
    succeeded('sign-off'),
  ],
  async task(c) {
    await c.send('Write greet.js that greets in our house style.')
    await c.exec(
      `grep -q ${process.env.REEVAL_COMPARE_SIDE === 'head' ? 'Ahoy' : 'Hello'} greet.js`,
      { label: 'house greeting' },
    )
    await c.exec('grep -q "!" greet.js', { label: 'sign-off' })
  },
})
