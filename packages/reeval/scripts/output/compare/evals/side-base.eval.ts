import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

export default defineEval({
  graders: [succeeded('german greeting')],
  async task(c) {
    await c.send('Write greet.js that greets in German.')
    await c.exec('grep -q Hallo greet.js', { label: 'german greeting' })
  },
})
