import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

export default defineEval({
  graders: [succeeded('spanish greeting')],
  async task(c) {
    await c.send('Write greet.js that greets in Spanish.')
    await c.exec('grep -q Hola greet.js', { label: 'spanish greeting' })
  },
})
