import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('greet.js', { name: 'writes greet.js' })],
  async task(c) {
    await c.send('Write greet.js.')
  },
})
