import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

export default defineEval({
  graders: [succeeded('french greeting', { required: true }), succeeded('informal greeting')],
  async task(c) {
    await c.send('Write greet.js that greets in French.')
    await c.exec('grep -q Bonjour greet.js', { label: 'french greeting' })
    await c.exec('grep -q Salut greet.js', { label: 'informal greeting' })
  },
})
