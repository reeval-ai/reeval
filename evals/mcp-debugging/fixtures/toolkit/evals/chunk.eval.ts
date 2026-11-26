import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/chunk.js', 'slice(', { name: 'cuts-with-slice' })],
  task: async (c) => {
    await c.send('Write src/chunk.js: chunk(xs, n) splits xs into arrays of n items.')
  },
})
