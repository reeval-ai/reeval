import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/uniq.js', 'new Set(', { name: 'dedupes-with-a-Set' })],
  task: async (c) => {
    await c.send('Write src/uniq.js: uniq(xs) drops repeated items, keeping the first.')
  },
})
