import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/clamp.js', 'Math.min(', { name: 'bounds-with-Math.min' })],
  task: async (c) => {
    await c.send('Write src/clamp.js: clamp(n, lo, hi) keeps n between lo and hi.')
  },
})
