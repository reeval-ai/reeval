import { defineEval } from 'reeval'
import { hasFile, judge } from 'reeval/graders'

export default defineEval({
  graders: [
    hasFile('greet.js', /Hello/, { required: true }),
    judge('Does greet.js export greet?', { name: 'exports-greet', inputs: { diff: true } }),
  ],
  task: async (c) => {
    await c.send('Write greet.js exporting greet(name).')
  },
})
